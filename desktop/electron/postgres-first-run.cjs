"use strict";
/** J.A.R.V.I.S. 17.6.1 — packaged Windows only. First launch on a genuinely clean profile.
 * Never migrates, removes or overwrites a database. Never called from renderer/IPC.
 */
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const net = require("node:net");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const execFileAsync = promisify(execFile);
const { runPgControl, isPostmasterDescendant } = require("./postgres-process.cjs");

const PORT = 55432;
const APP_FOLDER = "JarvisData";
const DB_NAME = "jarvis_db";
const DB_USER = "jarvis";

function noExistingLinks(file, fsImpl = fs) {
  const absolute = path.resolve(file);
  const root = path.parse(absolute).root;
  let current = root;
  for (const segment of path
    .relative(root, absolute)
    .split(path.sep)
    .filter(Boolean)) {
    current = path.join(current, segment);
    try {
      const stat = fsImpl.lstatSync(current);
      if (stat.isSymbolicLink())
        throw new Error("Niedozwolony symlink/junction w ścieżce bazy.");
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      // Remaining descendants do not yet exist.
      return;
    }
  }
}
function sha256(file, fsImpl = fs) {
  const digest = crypto.createHash("sha256");
  const fd = fsImpl.openSync(file, "r");
  try {
    const buffer = Buffer.allocUnsafe(1024 * 1024);
    while (true) {
      const count = fsImpl.readSync(fd, buffer, 0, buffer.length, null);
      if (!count) break;
      digest.update(buffer.subarray(0, count));
    }
  } finally {
    fsImpl.closeSync(fd);
  }
  return digest.digest("hex");
}
function pathsFor(
  resourcesPath,
  env,
  fsImpl = fs,
  platform = process.platform,
) {
  if (
    platform !== "win32" ||
    typeof resourcesPath !== "string" ||
    !path.isAbsolute(resourcesPath) ||
    !env.APPDATA ||
    !path.isAbsolute(env.APPDATA)
  ) {
    throw new Error(
      "17.6.1 wymaga spakowanej aplikacji Windows i poprawnego APPDATA.",
    );
  }
  const home = path.join(resourcesPath, "postgres");
  const appDir = path.join(env.APPDATA, APP_FOLDER);
  const stateDir = path.join(appDir, "postgres17");
  const bin = path.join(home, "bin");
  const paths = {
    home,
    bin,
    appDir,
    stateDir,
    dataDir: path.join(stateDir, "data"),
    envFile: path.join(appDir, "backend.env"),
    stateFile: path.join(stateDir, "state.json"),
    secretFile: path.join(stateDir, "credentials.json"),
    pgctl: path.join(bin, "pg_ctl.exe"),
    initdb: path.join(bin, "initdb.exe"),
    createdb: path.join(bin, "createdb.exe"),
    psql: path.join(bin, "psql.exe"),
    postgres: path.join(bin, "postgres.exe"),
    manifest: path.join(home, "stage17-3-manifest.json"),
  };
  for (const file of Object.values(paths)) noExistingLinks(file, fsImpl);
  return paths;
}
function validateStage(p, fsImpl = fs) {
  for (const name of [
    "pgctl",
    "initdb",
    "createdb",
    "psql",
    "postgres",
    "manifest",
  ]) {
    if (!fsImpl.statSync(p[name]).isFile())
      throw new Error(`Brak PostgreSQL: ${name}.`);
  }
  const meta = JSON.parse(fsImpl.readFileSync(p.manifest, "utf8"));
  if (
    meta.schema !== "jarvis.pg.binaries.v1" ||
    !/\b17\.\d+\b/.test(meta.version) ||
    !/^[0-9a-f]{64}$/.test(meta.postgres_sha256) ||
    !/^[0-9a-f]{64}$/.test(meta.initdb_sha256) ||
    sha256(p.postgres, fsImpl) !== meta.postgres_sha256 ||
    sha256(p.initdb, fsImpl) !== meta.initdb_sha256
  ) {
    throw new Error(
      "Manifest lub pliki PostgreSQL 17 nie przechodzą kontroli integralności.",
    );
  }
  return meta.version;
}
function portBusy(host = "127.0.0.1", port = PORT) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port });
    let finished = false;
    function done(value, error) {
      if (finished) return;
      finished = true;
      socket.destroy();
      if (error) reject(error);
      else resolve(value);
    }
    socket.once("connect", () => done(true));
    socket.once("error", (error) => {
      if (error.code === "ECONNREFUSED") done(false);
      else done(true); // conservatively treat any other socket failure as occupied
    });
    socket.setTimeout(1200, () => done(true));
  });
}
function writeExclusive(file, content, fsImpl = fs) {
  noExistingLinks(file, fsImpl);
  const fd = fsImpl.openSync(file, "wx", 0o600);
  try {
    fsImpl.writeFileSync(fd, content, { encoding: "utf8" });
    fsImpl.fsyncSync(fd);
  } finally {
    fsImpl.closeSync(fd);
  }
}
function systemTool(name, env) {
  const root = env.SystemRoot || env.WINDIR;
  if (typeof root !== "string" || !path.isAbsolute(root)) {
    throw new Error("Nie można znaleźć zaufanego katalogu SystemRoot Windows.");
  }
  return path.join(root, "System32", name);
}
function asText(result) {
  return typeof result === "string" ? result : String(result?.stdout ?? "");
}
function sanitizedCode(error) {
  const code = error?.code;
  return typeof code === "number" && Number.isInteger(code)
    ? ` (exit ${code})`
    : "";
}

// A failed pg_ctl can leave a server running. Only identify a newly created
// postmaster for this exact cluster and attempt; never adopt a port listener.
function postmasterSnapshot(dataDir, fsImpl = fs) {
  const file = path.join(dataDir, "postmaster.pid");
  noExistingLinks(file, fsImpl);
  try {
    const stat = fsImpl.statSync(file);
    if (!stat.isFile() || stat.size > 4096) return null;
    const text = fsImpl.readFileSync(file, "utf8");
    const lines = text.split(/\r?\n/).map((line) => line.trim());
    const sameDirectory = path.resolve(lines[1] || "").toLowerCase() ===
      path.resolve(dataDir).toLowerCase();
    if (!/^[1-9]\d*$/.test(lines[0]) || !sameDirectory ||
        !/^[1-9]\d*$/.test(lines[2]) || lines[3] !== String(PORT)) return null;
    return { text, pid: Number(lines[0]), startedAt: Number(lines[2]) };
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

async function stopNewPostmaster({ dataDir, before, attemptedAt, controllerPid,
  command, fsImpl = fs, env = process.env, ownershipImpl = isPostmasterDescendant }) {
  if (before || !Number.isSafeInteger(controllerPid) || controllerPid <= 0) return false;
  // A descendant can write its PID shortly after pg_ctl itself fails.
  const deadline = Date.now() + 1500;
  let current = postmasterSnapshot(dataDir, fsImpl);
  while (!current && Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, 50));
    current = postmasterSnapshot(dataDir, fsImpl);
  }
  if (!current || current.startedAt < Math.floor(attemptedAt / 1000) - 1 ||
      current.startedAt > Math.floor(Date.now() / 1000) + 1) return false;
  if (!await ownershipImpl({ postmasterPid: current.pid, controllerPid, attemptedAt, env })) return false;
  await command(["-D", dataDir, "status"], 10000);
  if (postmasterSnapshot(dataDir, fsImpl)?.text !== current.text) return false;
  await command(["-D", dataDir, "-m", "fast", "-w", "-t", "30", "stop"], 40000);
  return true;
}

async function bootstrap({
  resourcesPath,
  env = process.env,
  fsImpl = fs,
  platform = process.platform,
  execImpl,
  busyImpl = portBusy,
  random = crypto.randomBytes,
  signal,
  ownershipImpl = isPostmasterDescendant,
} = {}) {
  const p = pathsFor(resourcesPath, env, fsImpl, platform);
  // Existing installations and half-completed attempts are NEVER repaired automatically.
  // The 17.3 runtime will independently verify state and stop if it is inconsistent.
  if (fsImpl.existsSync(p.stateDir) || fsImpl.existsSync(p.envFile)) {
    return { mode: "existing", created: false };
  }
  const legacy = path.join(env.APPDATA, "J.A.R.V.I.S.");
  for (const name of ["backend.env", "postgres17"]) {
    const file = path.join(legacy, name);
    noExistingLinks(file, fsImpl);
    if (fsImpl.existsSync(file)) {
      throw new Error("JARVIS_LEGACY_DB_DATA: Wykryto poprzednie dane bazy. " +
        "Wymagany przegląd i kontrolowana migracja; niczego nie zmieniono.");
    }
  }
  for (const key of [
    "JARVIS_DB_HOST",
    "JARVIS_DB_PORT",
    "JARVIS_DB_NAME",
    "JARVIS_DB_USER",
    "JARVIS_DB_PASSWORD",
  ]) {
    if (Object.hasOwn(env, key) && env[key])
      throw new Error(
        `17.6.1: ustawiono ${key}; brak automatycznej inicjalizacji.`,
      );
  }
  const version = validateStage(p, fsImpl);
  if (await busyImpl())
    throw new Error(
      "Port 55432 jest zajęty. Nie przejmuję istniejącego PostgreSQL.",
    );
  async function command(exe, args, { timeout = 120000, childEnv = env, cleanup = false } = {}) {
    try {
      if (!cleanup && signal?.aborted) throw new Error("Anulowano inicjalizację bazy.");
      const execute = execImpl || (exe === p.pgctl ? runPgControl : execFileAsync);
      return await execute(exe, args, {
        env: { ...childEnv, PGPASSWORD: childEnv.PGPASSWORD || "" },
        shell: false,
        windowsHide: true,
        timeout,
        maxBuffer: 64 * 1024,
        // Do not interrupt pg_ctl midway through launching a descendant. Let
        // its bounded -w finish, then cancel and stop the identified server.
        ...(!cleanup && signal && exe !== p.pgctl ? { signal } : {}),
      });
    } catch (error) {
      // Do not expose stderr: native tools can contain environment details.
      const safeError = new Error(
        `Niepowodzenie: ${path.basename(exe)}${sanitizedCode(error)}.`,
      );
      if (Number.isSafeInteger(error?.controllerPid) && error.controllerPid > 0) {
        safeError.controllerPid = error.controllerPid;
      }
      throw safeError;
    }
  }
  async function privateAcl(target, isDir, sid) {
    const grant = isDir ? `*${sid}:(OI)(CI)F` : `*${sid}:F`;

    await command(
      systemTool("icacls.exe", env),
      [target, "/inheritance:r", "/grant:r", grant],
      { timeout: 20000 },
    );
  }
  const identity = asText(
    await command(
      systemTool("whoami.exe", env),
      ["/user", "/fo", "csv", "/nh"],
      { timeout: 10000 },
    ),
  );
  const sid = identity.match(/S-1-(?:\d+-){2,}\d+/)?.[0];
  if (!sid) throw new Error("Nie można ustalić SID użytkownika Windows.");
  noExistingLinks(p.appDir, fsImpl);
  fsImpl.mkdirSync(p.appDir, { recursive: true });
  // backend.env must inherit a private ACL even if its later icacls fails.
  await privateAcl(p.appDir, true, sid);
  // Exclusive create prevents overwriting user history or a concurrent initialization.
  fsImpl.mkdirSync(p.stateDir, { recursive: false, mode: 0o700 });
  let pgStarted = false;
  const password = random(48).toString("base64url");
  const secretEnv = {
    ...env,
    PGPASSWORD: password,
    PGHOST: "127.0.0.1",
    PGPORT: String(PORT),
    PGUSER: DB_USER,
  };
  const pwfile = path.join(p.stateDir, ".initdb-secret");
  let startAttempt = null;
  try {
    await privateAcl(p.stateDir, true, sid);
    // Persist the private recovery credential before starting native tools.
    // A partial cluster is still never activated or repaired automatically.
    writeExclusive(p.secretFile, JSON.stringify({
      schema: "jarvis.postgres17.credentials.v1", password,
    }) + "\n", fsImpl);
    await privateAcl(p.secretFile, false, sid);
    writeExclusive(pwfile, password + "\n", fsImpl);
    await privateAcl(pwfile, false, sid);
    try {
      await command(
        p.initdb,
        [
          "-D",
          p.dataDir,
          "-U",
          DB_USER,
          "--encoding=UTF8",
          "--auth-host=scram-sha-256",
          "--auth-local=scram-sha-256",
          "--pwfile",
          pwfile,
        ],
        { timeout: 180000 },
      );
    } finally {
      if (fsImpl.existsSync(pwfile)) fsImpl.unlinkSync(pwfile);
    }
    if (
      fsImpl.readFileSync(path.join(p.dataDir, "PG_VERSION"), "utf8").trim() !==
      "17"
    ) {
      throw new Error("initdb nie utworzył poprawnego klastra PostgreSQL 17.");
    }
    const postgresqlConf = path.join(p.dataDir, "postgresql.conf");
    const hba = path.join(p.dataDir, "pg_hba.conf");
    for (const file of [postgresqlConf, hba]) noExistingLinks(file, fsImpl);
    fsImpl.appendFileSync(
      postgresqlConf,
      "\n# J.A.R.V.I.S. 17.6.1: localhost only\nlisten_addresses = '127.0.0.1'\nport = 55432\npassword_encryption = 'scram-sha-256'\n",
    );
    fsImpl.writeFileSync(
      hba,
      "# J.A.R.V.I.S. — only local SCRAM authenticated TCP\n" +
        "host all all 127.0.0.1/32 scram-sha-256\n",
      { flag: "w" },
    );
    if (await busyImpl())
      throw new Error("Port 55432 został zajęty podczas inicjalizacji.");
    startAttempt = { before: postmasterSnapshot(p.dataDir, fsImpl), attemptedAt: Date.now() };
    try { await command(
      p.pgctl,
      [
        "-D",
        p.dataDir,
        "-l",
        path.join(p.stateDir, "postgres.log"),
        "-w",
        "-t",
        "90",
        "start",
      ],
      { timeout: 100000 },
    ); } catch (error) {
      startAttempt.controllerPid = error.controllerPid;
      throw error;
    }
    pgStarted = true;
    await command(
      p.createdb,
      ["-h", "127.0.0.1", "-p", String(PORT), "-U", DB_USER, DB_NAME],
      { timeout: 30000, childEnv: secretEnv },
    );
    const verify = asText(
      await command(
        p.psql,
        [
          "-X",
          "-w",
          "-t",
          "-A",
          "-h",
          "127.0.0.1",
          "-p",
          String(PORT),
          "-U",
          DB_USER,
          "-d",
          DB_NAME,
          "-v",
          "ON_ERROR_STOP=1",
          "-c",
          "SELECT current_database()",
        ],
        { timeout: 30000, childEnv: secretEnv },
      ),
    ).trim();
    if (verify !== DB_NAME)
      throw new Error("Nie udało się zweryfikować nowej bazy jarvis_db.");
    await command(
      p.pgctl,
      ["-D", p.dataDir, "-m", "fast", "-w", "-t", "45", "stop"],
      { timeout: 55000 },
    );
    pgStarted = false;
    if (signal?.aborted) throw new Error("Anulowano inicjalizację bazy.");
    writeExclusive(
      p.envFile,
      "# J.A.R.V.I.S. 17.6.1 — nowa lokalna baza Windows\n" +
        "JARVIS_DB_HOST=127.0.0.1\nJARVIS_DB_PORT=55432\nJARVIS_DB_NAME=jarvis_db\n" +
        "JARVIS_DB_USER=jarvis\nJARVIS_DB_PASSWORD=" +
        password +
        "\n",
      fsImpl,
    );
    await privateAcl(p.envFile, false, sid);
    // Commit flag last. Existing runtime will reject any partial state.
    writeExclusive(
      p.stateFile,
      JSON.stringify(
        {
          schema: "jarvis.postgres17.v1",
          major: 17,
          port: PORT,
          database: DB_NAME,
          migrated: false,
          initializedFresh: true,
          activated: true,
          version,
          createdAt: new Date().toISOString(),
        },
        null,
        2,
      ) + "\n",
      fsImpl,
    );
    await privateAcl(p.stateFile, false, sid);
    return { mode: "fresh", created: true };
  } catch (error) {
    // An incomplete cluster must remain for manual diagnostics. Never retry/reinitialize it.
    throw error;
  } finally {
    if (fsImpl.existsSync(pwfile)) fsImpl.unlinkSync(pwfile);
    if (pgStarted) {
      try {
        await command(
          p.pgctl,
          ["-D", p.dataDir, "-m", "fast", "-w", "-t", "30", "stop"],
          { timeout: 40000, cleanup: true },
        );
      } catch {
        /* preserve original failure; next start will be blocked */
      }
    } else if (startAttempt && !fsImpl.existsSync(p.stateFile)) {
      try {
        await stopNewPostmaster({
          ...startAttempt, dataDir: p.dataDir, fsImpl, env, ownershipImpl,
          command: (args, timeout) => command(p.pgctl, args, { timeout, cleanup: true }),
        });
      } catch {
        // Keep the cluster and private recovery credential for manual review.
      }
    }
  }
}

let inFlight = null;
function ensureFirstRunDatabase(options) {
  if (inFlight) return inFlight;
  inFlight = bootstrap(options).finally(() => {
    inFlight = null;
  });
  return inFlight;
}
module.exports = {
  pathsFor,
  validateStage,
  bootstrap,
  ensureFirstRunDatabase,
  portBusy,
  postmasterSnapshot,
  stopNewPostmaster,
};
