"use strict";

// Used only by postgres-native-smoke --with-backend, against its private cluster.
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const crypto = require("node:crypto");
const { spawn } = require("node:child_process");
const { resolveBundledJava } = require("../desktop/electron/bundled-java.cjs");

function requireCondition(ok, code) {
  if (!ok) throw Object.assign(new Error(code), { code });
}

function stopOwnedChild(child, timeout = 10000) {
  if (!child || child.exitCode != null || child.signalCode != null) return Promise.resolve();
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = error => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.removeListener("exit", onExit);
      if (error) reject(error); else resolve();
    };
    const onExit = () => finish();
    const timer = setTimeout(() => finish(Object.assign(new Error("JAVA_STOP_UNCONFIRMED"),
      { code: "JAVA_STOP_UNCONFIRMED", javaStoppedConfirmed: false })), timeout);
    child.once("exit", onExit);
    // The saved ChildProcess is the only process this tool is allowed to kill.
    try { if (!child.killed) child.kill(); }
    catch { finish(Object.assign(new Error("JAVA_STOP_UNCONFIRMED"),
      { code: "JAVA_STOP_UNCONFIRMED", javaStoppedConfirmed: false })); }
  });
}

async function runBackendSmoke({ resources, directory, dbPort, password, query, env, httpPort }) {
  const java = resolveBundledJava(resources);
  const jar = path.join(resources, "backend", "jarvis-backend.jar");
  const manifest = JSON.parse(fs.readFileSync(path.join(resources, "backend", "stage17-2-manifest.json"), "utf8"));
  const hash = file => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
  requireCondition(manifest.schema === "jarvis.windows17.backend.v1" && /^21\./.test(manifest.java_version) &&
    hash(java) === manifest.sha256_java && hash(jar) === manifest.sha256_jar, "JAVA_BUNDLE_INTEGRITY_FAILED");
  requireCondition(Number.isInteger(httpPort) && httpPort > 1024 && ![8080, 55432, dbPort].includes(httpPort), "HTTP_PORT_REFUSED");
  const javaHome = path.join(directory, "java-home");
  const javaTemp = path.join(directory, "java-temp");
  fs.mkdirSync(javaHome);
  fs.mkdirSync(javaTemp);
  let child = null;
  let processError = null;
  let session = null;
  let failure = null;
  let result = null;

  // node:http connects directly to loopback, independent of inherited proxy settings.
  function request(method, endpoint, { authenticated = true, body } = {}) {
    return new Promise((resolve, reject) => {
      const data = body === undefined ? null : JSON.stringify(body);
      const req = http.request({ host: "127.0.0.1", port: httpPort, path: endpoint, method,
        headers: { ...(authenticated ? { "X-Jarvis-Session": session } : {}),
          ...(data ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) } : {}) } }, res => {
        const chunks = [];
        let size = 0;
        res.on("data", chunk => {
          size += chunk.length;
          if (size > 100000) req.destroy(new Error("HTTP_RESPONSE_TOO_LARGE"));
          else chunks.push(chunk);
        });
        res.on("end", () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString("utf8") }));
        res.on("error", reject);
      });
      req.setTimeout(2000, () => req.destroy(new Error("HTTP_TIMEOUT")));
      req.on("error", reject);
      req.end(data);
    });
  }

  async function startJava() {
    session = crypto.randomBytes(32).toString("hex");
    processError = null;
    child = spawn(java, [
      `-Duser.home=${javaHome}`, `-Djava.io.tmpdir=${javaTemp}`, "-jar", jar,
      "--server.address=127.0.0.1", `--server.port=${httpPort}`,
      `--jarvis.model.checkpoint-file=${path.join(javaHome, "checkpoint.ckpt")}`,
      `--jarvis.chat.knowledge-file=${path.join(javaHome, "knowledge.properties")}`,
      "--logging.level.root=ERROR", `--logging.file.name=${path.join(directory, "backend-error.log")}`,
      "--spring.main.banner-mode=off", "--spring.main.log-startup-info=false",
    ], { cwd: directory, shell: false, windowsHide: true, stdio: "ignore",
      env: { ...env, JARVIS_DB_HOST: "127.0.0.1", JARVIS_DB_PORT: String(dbPort),
        JARVIS_DB_NAME: "jarvis_smoke", JARVIS_DB_USER: "jarvis_smoke", JARVIS_DB_PASSWORD: password,
        JARVIS_SESSION_TOKEN: session } });
    child.on("error", error => { processError = error; });
    const deadline = Date.now() + 60000;
    while (Date.now() < deadline) {
      requireCondition(!processError && child.exitCode == null && child.signalCode == null, "JAVA_START_FAILED");
      let response;
      try { response = await request("GET", "/api/security/private-health"); }
      catch { /* Only this newly spawned backend is polled on the private port. */ }
      if (response?.status === 200) {
        requireCondition(JSON.parse(response.body).status === "AUTHENTICATED", "PRIVATE_HEALTH_FAILED");
        requireCondition((await request("GET", "/api/security/private-health", { authenticated: false })).status === 401,
          "PRIVATE_HEALTH_NOT_PROTECTED");
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    throw Object.assign(new Error("JAVA_START_TIMEOUT"), { code: "JAVA_START_TIMEOUT" });
  }

  try {
    await startJava();
    const initial = await request("GET", "/api/chats");
    requireCondition(initial.status === 200 && JSON.parse(initial.body).length === 0, "INITIAL_CHATS_FAILED");
    const created = await request("POST", "/api/chats", { body: { title: "Native smoke conversation" } });
    requireCondition(created.status === 201, "CREATE_CHAT_FAILED");
    const id = JSON.parse(created.body).id;
    requireCondition(typeof id === "string" && /^[0-9a-f-]{36}$/i.test(id), "CHAT_ID_FAILED");
    const containsChat = async () => {
      const response = await request("GET", "/api/chats");
      requireCondition(response.status === 200 && JSON.parse(response.body).some(chat =>
        chat.id === id && chat.title === "Native smoke conversation"), "CHAT_RESTART_PERSISTENCE_FAILED");
    };
    await containsChat();
    await stopOwnedChild(child);
    await startJava();
    await containsChat();
    const migrations = (await query("SELECT string_agg(version, ',' ORDER BY installed_rank) FROM flyway_schema_history WHERE success AND type='SQL'")).stdout.trim();
    requireCondition(migrations === "1,2,3,4,5", "FLYWAY_VERSIONS_FAILED");
    requireCondition((await query("SELECT count(*) FROM jarvis_conversations")).stdout.trim() === "1", "SQL_CHAT_COUNT_FAILED");
    requireCondition((await query("SELECT count(*) FROM jarvis_messages")).stdout.trim() === "0", "UNEXPECTED_MODEL_MESSAGES");
    result = { status: "PASS", httpPort, privateHealthProtected: true, flywayVersions: [1, 2, 3, 4, 5],
      createdConversations: 1, persistedAfterJavaRestart: true, modelRequests: 0, javaStoppedConfirmed: true };
  } catch (error) { failure = error; }
  try {
    // Spawn errors have no process to stop; otherwise await this exact child exit.
    if (!processError || child?.pid) await stopOwnedChild(child);
  } catch (error) { throw error; }
  if (failure) throw Object.assign(failure, { javaStoppedConfirmed: true });
  return result;
}

module.exports = { runBackendSmoke, stopOwnedChild };
