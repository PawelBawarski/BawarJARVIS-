"use strict";

/**
 * J.A.R.V.I.S. 17.6.6
 * Managed PostgreSQL 17.
 * Electron MAIN only.
 * Never expose credentials or pg_ctl to IPC.
 */

const fs = require("node:fs");
const path = require("node:path");
const { runPgControl } = require("./postgres-process.cjs");

function noLinks(file, fsImpl = fs) {
  const absolute = path.resolve(file);
  const root = path.parse(absolute).root;

  let current = root;

  const segments = path
    .relative(root, absolute)
    .split(path.sep)
    .filter(Boolean);

  for (const segment of segments) {
    current = path.join(current, segment);

    let stat;

    try {
      stat = fsImpl.lstatSync(current);
    } catch (error) {
      if (error.code === "ENOENT") {
        return;
      }

      throw error;
    }

    if (stat.isSymbolicLink()) {
      throw new Error("Niedozwolony symlink/junction w ścieżce PostgreSQL.");
    }
  }
}

function locations(
  resourcesPath,
  env = process.env,
  fsImpl = fs,
  platform = process.platform,
) {
  if (platform !== "win32" || typeof resourcesPath !== "string" ||
      !path.isAbsolute(resourcesPath) || !env.APPDATA || !path.isAbsolute(env.APPDATA)) {
    throw new Error(
      "PostgreSQL 17.3: wymagane spakowane zasoby Windows oraz APPDATA.",
    );
  }

  const pgctl = path.join(resourcesPath, "postgres", "bin", "pg_ctl.exe");

  const appDir = path.join(env.APPDATA, "JarvisData");

  const stateDir = path.join(appDir, "postgres17");
  const dataDir = path.join(stateDir, "data");
  const stateFile = path.join(stateDir, "state.json");
  const backendEnv = path.join(appDir, "backend.env");
  const pgVersion = path.join(dataDir, "PG_VERSION");

  for (const file of [pgctl, dataDir, stateFile, backendEnv, pgVersion]) {
    noLinks(file, fsImpl);
  }

  // Never overwrite an existing legacy configuration.
  if (!fsImpl.existsSync(stateDir)) {
    if (fsImpl.existsSync(backendEnv)) {
      throw new Error(
        "JARVIS_LEGACY_DB_CONFIG: " +
          "Wykryto backend.env, ale brak zarządzanego " +
          "klastra PostgreSQL 17. " +
          "Zachowano dotychczasową konfigurację. " +
          "Wymagana jest kontrolowana migracja " +
          "lub osobny profil Windows.",
      );
    }

    throw new Error(
      "JARVIS_DB_NOT_INITIALIZED: " + "Brak klastra PostgreSQL 17.",
    );
  }

  const requiredFiles = [pgctl, stateFile, backendEnv, pgVersion];

  if (
    !requiredFiles.every((file) => fsImpl.existsSync(file)) ||
    !fsImpl.statSync(pgctl).isFile() ||
    fsImpl.readFileSync(pgVersion, "utf8").trim() !== "17"
  ) {
    throw new Error("Brak dołączonego PostgreSQL 17 lub klastra danych.");
  }

  const state = JSON.parse(fsImpl.readFileSync(stateFile, "utf8"));

  if (
    state.schema !== "jarvis.postgres17.v1" ||
    (state.migrated !== true && state.initializedFresh !== true) ||
    state.activated !== true ||
    state.port !== 55432 ||
    state.database !== "jarvis_db"
  ) {
    throw new Error(
      "Baza nie została zweryfikowana i aktywowana. " + "Ukończ migrację 17.3.",
    );
  }

  // Prevent silent fallback to external databases.
  const requiredEnv = {
    JARVIS_DB_PORT: "55432",
    JARVIS_DB_HOST: "127.0.0.1",
    JARVIS_DB_NAME: "jarvis_db",
  };

  for (const [key, value] of Object.entries(requiredEnv)) {
    if (env[key] && env[key] !== value) {
      throw new Error(`Konflikt ustawień procesu: ${key}.`);
    }
  }

  const config = fsImpl.readFileSync(backendEnv, "utf8");

  if (
    !/^JARVIS_DB_HOST=127\.0\.0\.1\s*$/m.test(config) ||
    !/^JARVIS_DB_PORT=55432\s*$/m.test(config) ||
    !/^JARVIS_DB_NAME=jarvis_db\s*$/m.test(config)
  ) {
    throw new Error(
      "backend.env nie wskazuje aktywowanego lokalnego PostgreSQL.",
    );
  }

  return { pgctl, dataDir, stateDir };
}

function createPostgresRuntime({
  resourcesPath,
  env = process.env,
  fsImpl = fs,
  execImpl = runPgControl,
  platform = process.platform,
  ownershipImpl,
} = {}) {
  let owned = false;
  let startPromise = null;
  let stopping = false;
  let stopPromise = null;
  let info = null;

  async function run(args, timeout = 60000) {
    return execImpl(info.pgctl, args, {
      windowsHide: true,
      shell: false,
      timeout,
      maxBuffer: 128 * 1024,
      env: { ...env, PGPASSWORD: "" },
    });
  }

  async function isStarted() {
    try {
      await run(["-D", info.dataDir, "status"], 10000);
      return true;
    } catch (error) {
      // Exit code 3: PostgreSQL server is not running.
      if (typeof error?.code === "number" && error.code === 3) {
        return false;
      }

      throw error;
    }
  }

  async function start() {
    if (startPromise) return startPromise;

    startPromise = (async () => {
      if (stopping) {
        throw new Error("Trwa zamykanie lokalnej bazy.");
      }

      info = locations(resourcesPath, env, fsImpl, platform);

      if (await isStarted()) {
        return { started: true, owned: false };
      }
      if (stopping) throw new Error("Anulowano uruchamianie lokalnej bazy.");
      const attempt = { before: postmasterSnapshot(info.dataDir, fsImpl), attemptedAt: Date.now() };
      try {
        await run(
        [
          "-D",
          info.dataDir,
          "-l",
          path.join(info.stateDir, "postgres.log"),
          "-w",
          "-t",
          "90",
          "start",
        ],
        100000,
        );
      } catch (error) {
        try {
          await stopNewPostmaster({ ...attempt, controllerPid: error?.controllerPid,
            dataDir: info.dataDir, fsImpl, env, ownershipImpl, command: run });
        } catch { /* Preserve data; never stop an unverified cluster. */ }
        throw new Error("Nie udało się uruchomić lokalnego PostgreSQL 17. " +
          "Zachowano dane; sprawdź stan klastra i postgres.log.");
      }

      owned = true;

      if (stopping) {
        await stopOwned();
        throw new Error("Zamknięto aplikację podczas uruchamiania bazy.");
      }

      return { started: true, owned: true };
    })();

    try {
      return await startPromise;
    } catch (error) {
      startPromise = null;
      throw error;
    }
  }

  async function stopOwned() {
    if (!owned || !info) return;
    try {
      await run(
        ["-D", info.dataDir, "-m", "fast", "-w", "-t", "30", "stop"],
        40000,
      );
      owned = false;
    } catch {
      throw new Error("Nie potwierdzono zatrzymania lokalnego PostgreSQL 17. Zachowano dane.");
    }
  }

  function stop() {
    stopping = true;
    if (!stopPromise) {
      stopPromise = (async () => {
        try { await startPromise; } catch { /* Startup already reported its error. */ }
        await stopOwned();
      })().catch((error) => { stopPromise = null; throw error; });
    }
    return stopPromise;
  }

  return { start, stop };
}

const { ensureFirstRunDatabase, postmasterSnapshot, stopNewPostmaster } = require("./postgres-first-run.cjs");

function createDatabaseLifecycle({ bootstrapImpl = ensureFirstRunDatabase,
  runtimeFactory = createPostgresRuntime } = {}) {
  const controller = new AbortController();
  let runtime = null;
  let startPromise = null;
  let stopPromise = null;
  let stopping = false;
  function start(options = {}) {
    if (stopping) return Promise.reject(new Error("Trwa zamykanie lokalnej bazy."));
    if (!startPromise) startPromise = (async () => {
      await bootstrapImpl({ ...options, signal: controller.signal });
      if (stopping) throw new Error("Anulowano uruchamianie lokalnej bazy.");
      runtime = runtimeFactory(options);
      return runtime.start();
    })();
    return startPromise;
  }
  function stop() {
    stopping = true;
    controller.abort();
    if (!stopPromise) stopPromise = (async () => {
      try { await startPromise; } catch { /* Bootstrap cleanup finishes before returning. */ }
      await runtime?.stop();
    })().catch((error) => { stopPromise = null; throw error; });
    return stopPromise;
  }
  return { start, stop };
}

let lifecycle = createDatabaseLifecycle();
function startPackagedDatabase(options) { return lifecycle.start(options); }
async function stopPackagedDatabase() {
  const old = lifecycle;
  await old.stop();
  if (lifecycle === old) lifecycle = createDatabaseLifecycle();
}

module.exports = {
  locations,
  createPostgresRuntime,
  startPackagedDatabase,
  stopPackagedDatabase,
  createDatabaseLifecycle,
};
