"use strict";

// Opt-in Windows integration test. Uses a new private temporary cluster only.
// No Electron userData, JarvisData, Docker, backend.env or application port access.
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const net = require("node:net");
const crypto = require("node:crypto");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const { validateStage } = require("../desktop/electron/postgres-first-run.cjs");
const { runPgControl } = require("../desktop/electron/postgres-process.cjs");
const execute = promisify(execFile);
const PREFIX = "jarvis-pg-native-smoke-";
const MARKER = ".jarvis-native-smoke.json";
const SCHEMA = "jarvis.pg.native-smoke.v1";

function requireCondition(ok, code) {
  if (!ok) throw Object.assign(new Error(code), { code });
}

function cleanEnvironment(env) {
  return Object.fromEntries(Object.entries(env).filter(([key]) =>
    !/^(PG|JARVIS_|SPRING_|SERVER_|LOGGING_)/i.test(key) &&
    !/^(DATABASE_URL|JAVA_TOOL_OPTIONS|JDK_JAVA_OPTIONS|_JAVA_OPTIONS)$/i.test(key)));
}

function noLinks(target) {
  let current = path.resolve(target);
  while (true) {
    try { requireCondition(!fs.lstatSync(current).isSymbolicLink(), "LINK_REFUSED"); }
    catch (error) { if (error.code !== "ENOENT") throw error; }
    const parent = path.dirname(current);
    if (parent === current) return;
    current = parent;
  }
}

function ownedTempPath(directory, token, stoppedConfirmed) {
  requireCondition(stoppedConfirmed === true, "STOP_NOT_CONFIRMED");
  const base = path.resolve(os.tmpdir());
  const target = path.resolve(directory);
  const relative = path.relative(base, target);
  requireCondition(path.isAbsolute(directory) && relative.startsWith(PREFIX) &&
    !relative.includes(path.sep) && path.basename(target).startsWith(PREFIX), "TEMP_SCOPE_REFUSED");
  noLinks(target);
  requireCondition(fs.realpathSync(target) === target && fs.realpathSync(path.dirname(target)) === fs.realpathSync(base), "TEMP_SCOPE_REFUSED");
  const marker = path.join(target, MARKER);
  noLinks(marker);
  const identity = JSON.parse(fs.readFileSync(marker, "utf8"));
  requireCondition(identity.schema === SCHEMA && identity.token === token && identity.pid === process.pid,
    "TEMP_MARKER_REFUSED");
  return target;
}

function cleanupTemp(directory, token, stoppedConfirmed) {
  // Verify the resolved absolute target and ownership immediately before removal.
  const target = ownedTempPath(directory, token, stoppedConfirmed);
  fs.rmSync(target, { recursive: true, force: false });
}

async function unusedLoopbackPort(excluded = [55432, 8080]) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const server = net.createServer();
    const port = await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen({ host: "127.0.0.1", port: 0, exclusive: true }, () => resolve(server.address().port));
    });
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    if (!excluded.includes(port)) return port;
  }
  throw Object.assign(new Error("PORT_SELECTION_FAILED"), { code: "PORT_SELECTION_FAILED" });
}

function safeCode(error) {
  if (Number.isInteger(error?.code)) return error.code;
  const code = String(error?.code || "SMOKE_FAILED");
  return /^[A-Z][A-Z0-9_]{1,63}$/.test(code) ? code : "SMOKE_FAILED";
}

async function runNativeSmoke({ withBackend = false } = {}) {
  requireCondition(process.platform === "win32", "WINDOWS_REQUIRED");
  const resources = path.resolve(__dirname, "../desktop/resources");
  const pgHome = path.join(resources, "postgres");
  const binaries = Object.fromEntries([
    ["pgctl", "pg_ctl.exe"], ["initdb", "initdb.exe"], ["createdb", "createdb.exe"],
    ["psql", "psql.exe"], ["postgres", "postgres.exe"],
  ].map(([name, file]) => [name, path.join(pgHome, "bin", file)]));
  binaries.manifest = path.join(pgHome, "stage17-3-manifest.json");
  for (const file of Object.values(binaries)) noLinks(file);
  const version = validateStage(binaries);
  const baseEnv = cleanEnvironment(process.env);
  const systemRoot = baseEnv.SystemRoot || baseEnv.WINDIR;
  requireCondition(typeof systemRoot === "string" && path.isAbsolute(systemRoot), "SYSTEM_ROOT_REQUIRED");

  let stage = "temporary_directory";
  let directory = null;
  let dataDir = null;
  let port = null;
  let startAttempted = false;
  let stoppedConfirmed = false;
  let javaStoppedConfirmed = true;
  let backend = null;
  const token = crypto.randomUUID();
  let childEnv = baseEnv;

  async function command(exe, args, { env = childEnv, timeout = 30000 } = {}) {
    return execute(exe, args, { env, shell: false, windowsHide: true, timeout,
      encoding: "utf8", maxBuffer: 64 * 1024 });
  }
  async function control(args, timeout = 40000) {
    return runPgControl(binaries.pgctl, ["-D", dataDir, ...args], { env: childEnv, timeout });
  }
  function clusterIdentity() {
    const file = path.join(dataDir, "postmaster.pid");
    noLinks(file);
    try {
      const stat = fs.statSync(file);
      if (!stat.isFile() || stat.size > 4096) return false;
      const lines = fs.readFileSync(file, "utf8").split(/\r?\n/).map(line => line.trim());
      return /^[1-9]\d*$/.test(lines[0]) &&
        path.resolve(lines[1] || "").toLowerCase() === dataDir.toLowerCase() && lines[3] === String(port);
    } catch (error) { if (error.code === "ENOENT") return false; throw error; }
  }
  async function verifyStopped() {
    try { await control(["status"], 10000); }
    catch (error) {
      if (error.code === 3 && !fs.existsSync(path.join(dataDir, "postmaster.pid"))) return true;
      throw error;
    }
    throw Object.assign(new Error("STOP_NOT_CONFIRMED"), { code: "STOP_NOT_CONFIRMED" });
  }
  async function stopCluster() {
    requireCondition(clusterIdentity(), "CLUSTER_IDENTITY_REFUSED");
    await control(["-m", "fast", "-w", "-t", "30", "stop"]);
    stoppedConfirmed = await verifyStopped();
  }

  try {
    const tempBase = path.resolve(os.tmpdir());
    noLinks(tempBase);
    directory = fs.mkdtempSync(path.join(tempBase, PREFIX));
    noLinks(directory);
    dataDir = path.join(directory, "data");
    stage = "private_acl";
    const identity = await command(path.join(systemRoot, "System32", "whoami.exe"), ["/user", "/fo", "csv", "/nh"], { timeout: 10000 });
    const sid = identity.stdout.match(/S-1-(?:\d+-){2,}\d+/)?.[0];
    requireCondition(Boolean(sid), "SID_REQUIRED");
    await command(path.join(systemRoot, "System32", "icacls.exe"),
      [directory, "/inheritance:r", "/grant:r", `*${sid}:(OI)(CI)F`], { timeout: 20000 });
    fs.writeFileSync(path.join(directory, MARKER), JSON.stringify({ schema: SCHEMA, token, pid: process.pid }), { flag: "wx", mode: 0o600 });
    const password = crypto.randomBytes(48).toString("base64url");
    const pwfile = path.join(directory, ".initdb-secret");
    fs.writeFileSync(pwfile, password + "\n", { flag: "wx", mode: 0o600 });
    childEnv = { ...baseEnv, LC_ALL: "C", LANG: "C", PGCLIENTENCODING: "UTF8",
      PGPASSFILE: path.join(directory, "no-user-pgpass"), PGSYSCONFDIR: directory, PGCONNECT_TIMEOUT: "5" };
    stage = "initdb";
    await command(binaries.initdb, ["-D", dataDir, "-U", "jarvis_smoke", "--encoding=UTF8", "--locale=C",
      "--auth-host=scram-sha-256", "--auth-local=scram-sha-256", "--pwfile", pwfile], { timeout: 180000 });
    requireCondition(fs.readFileSync(path.join(dataDir, "PG_VERSION"), "utf8").trim() === "17", "PG_VERSION_MISMATCH");
    port = await unusedLoopbackPort();
    requireCondition(port !== 55432, "APPLICATION_PORT_REFUSED");
    fs.appendFileSync(path.join(dataDir, "postgresql.conf"),
      `\nlisten_addresses = '127.0.0.1'\nport = ${port}\npassword_encryption = 'scram-sha-256'\nlc_messages = 'C'\n`);
    fs.writeFileSync(path.join(dataDir, "pg_hba.conf"), "host all all 127.0.0.1/32 scram-sha-256\n");
    const authEnv = { ...childEnv, PGPASSWORD: password };
    const args = ["-h", "127.0.0.1", "-p", String(port), "-U", "jarvis_smoke"];
    const query = (sql, env = authEnv) => command(binaries.psql,
      ["-X", "-w", "-t", "-A", ...args, "-d", "jarvis_smoke", "-v", "ON_ERROR_STOP=1", "-c", sql], { env });
    stage = "start";
    startAttempted = true;
    await control(["-l", path.join(directory, "postgres.log"), "-w", "-t", "30", "start"]);
    requireCondition(clusterIdentity(), "CLUSTER_IDENTITY_REFUSED");
    stage = "create_database_and_row";
    await command(binaries.createdb, ["-w", ...args, "jarvis_smoke"], { env: authEnv });
    // Leave public empty for the real first Flyway migration, whose fail-closed
    // baseline-on-migrate=false must also remain effective in integration tests.
    await query("CREATE SCHEMA smoke_evidence; CREATE TABLE smoke_evidence.smoke_proof (id integer PRIMARY KEY, value text NOT NULL); INSERT INTO smoke_evidence.smoke_proof VALUES (1, 'persisted');");
    requireCondition((await query("SELECT count(*) FROM smoke_evidence.smoke_proof WHERE id=1 AND value='persisted'")).stdout.trim() === "1", "ROW_CHECK_FAILED");
    stage = "restart";
    await stopCluster();
    stoppedConfirmed = false;
    await control(["-l", path.join(directory, "postgres.log"), "-w", "-t", "30", "start"]);
    requireCondition(clusterIdentity(), "CLUSTER_IDENTITY_REFUSED");
    requireCondition((await query("SELECT count(*) FROM smoke_evidence.smoke_proof WHERE id=1 AND value='persisted'")).stdout.trim() === "1", "PERSISTENCE_CHECK_FAILED");
    requireCondition((await query("SELECT 1")).stdout.trim() === "1", "SELECT_ONE_FAILED");
    stage = "reject_wrong_password";
    let rejected = false;
    try { await query("SELECT 1", { ...authEnv, PGPASSWORD: password + "-invalid" }); }
    catch (error) {
      rejected = error.code === 2 && /password authentication failed/i.test(String(error.stderr));
    }
    requireCondition(rejected, "WRONG_PASSWORD_NOT_REJECTED");
    requireCondition((await query("SELECT 1")).stdout.trim() === "1", "VALID_PASSWORD_CHECK_FAILED");
    if (withBackend) {
      stage = "backend_flyway_chat_restart";
      requireCondition((await query("SELECT count(*) FROM information_schema.tables WHERE table_schema='public'")).stdout.trim() === "0", "PUBLIC_SCHEMA_NOT_EMPTY");
      const { runBackendSmoke } = require("./backend-native-smoke.cjs");
      try {
        backend = await runBackendSmoke({ resources, directory, dbPort: port, password, query,
          env: baseEnv, httpPort: await unusedLoopbackPort([55432, 8080, port]) });
      } catch (error) {
        javaStoppedConfirmed = error.javaStoppedConfirmed !== false;
        throw error;
      }
    }
    stage = "stop";
    await stopCluster();
    stage = "cleanup";
    cleanupTemp(directory, token, stoppedConfirmed);
    return { status: "PASS", version, port, pgMajor: 17, persistedRows: 1, restarted: true,
      wrongPasswordRejected: true, stoppedConfirmed: true, temporaryClusterRemoved: true,
      ...(backend ? { backend } : {}) };
  } catch (error) {
    // Preserve every failed test directory. A controller failure may still have
    // launched a server, so stop only a postmaster identified in this own cluster.
    if (startAttempted && directory && dataDir && !stoppedConfirmed && javaStoppedConfirmed) {
      try {
        for (let attempt = 0; attempt < 30 && !clusterIdentity(); attempt++) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
        if (clusterIdentity()) await stopCluster();
        else stoppedConfirmed = await verifyStopped();
      } catch { /* Leave files intact when stop cannot be proved. */ }
    }
    return { status: "FAIL", stage, code: safeCode(error), temporaryDirectory: directory,
      stoppedConfirmed, javaStoppedConfirmed, temporaryClusterRemoved: false };
  }
}

if (require.main === module) {
  const args = process.argv.slice(2);
  if (!args.includes("--run") || new Set(args).size !== args.length ||
      args.some(arg => !["--run", "--with-backend"].includes(arg))) {
    console.error("Opt-in: node scripts/postgres-native-smoke.cjs --run [--with-backend]");
    process.exitCode = 2;
  } else {
    runNativeSmoke({ withBackend: args.includes("--with-backend") }).then(result => {
      console.log(JSON.stringify(result));
      if (result.status !== "PASS") process.exitCode = 1;
    }).catch(error => {
      console.error(JSON.stringify({ status: "FAIL", stage: "preflight", code: safeCode(error) }));
      process.exitCode = 1;
    });
  }
}

module.exports = { runNativeSmoke, cleanEnvironment, ownedTempPath, cleanupTemp };
