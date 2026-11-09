'use strict';

/**
 * Electron main only. Spawn the packaged local Spring Boot JAR as a CHILD.
 * No credentials or session token are exposed to renderer/preload IPC.
 * External PostgreSQL is a prerequisite; this module deliberately does not
 * start Docker, install Java, or alter the database.
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');

const API_URL = 'http://127.0.0.1:8080/api/chats';
const HEALTH_URL = 'http://127.0.0.1:8080/api/security/health';
const KEYS = ['JARVIS_DB_HOST', 'JARVIS_DB_PORT', 'JARVIS_DB_NAME', 'JARVIS_DB_USER', 'JARVIS_DB_PASSWORD'];
const DEFAULTS = {
  JARVIS_DB_HOST: '127.0.0.1',
  JARVIS_DB_PORT: '5433',
  JARVIS_DB_NAME: 'jarvis_db',
  JARVIS_DB_USER: 'jarvis',
};
const TEMPLATE = `# Konfiguracja lokalnej bazy JARVIS (tylko na tym komputerze).\n# Nie dodawaj tego pliku do repozytorium.\nJARVIS_DB_HOST=127.0.0.1\nJARVIS_DB_PORT=5433\nJARVIS_DB_NAME=jarvis_db\nJARVIS_DB_USER=jarvis\nJARVIS_DB_PASSWORD=\n`;

function configPath(env = process.env) {
  if (!env.APPDATA) {
    throw new Error('Brak APPDATA. Ten etap dotyczy aplikacji Windows.');
  }
  return path.join(env.APPDATA, 'J.A.R.V.I.S.', 'backend.env');
}

/** Parse a deliberately narrow .env subset (not source/eval/JS). */
function parseEnv(source) {
  const values = {};
  for (const line of source.split(/\r?\n/)) {
    const cleaned = line.trim();
    if (!cleaned || cleaned.startsWith('#')) continue;
    const m = /^([A-Z][A-Z0-9_]*)=(.*)$/.exec(cleaned);
    if (!m) throw new Error('Niepoprawny format konfiguracji backend.env.');
    const key = m[1];
    if (!KEYS.includes(key)) throw new Error(`Nieznany klucz konfiguracji: ${key}`);
    if (Object.hasOwn(values, key)) throw new Error(`Zduplikowany klucz konfiguracji: ${key}`);
    let value = m[2].trim();
    if (value.startsWith('"') && value.endsWith('"') && value.length >= 2) {
      value = value.slice(1, -1);
    } else if (value.startsWith("'") && value.endsWith("'") && value.length >= 2) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

function readDatabaseConfig({ env = process.env, filePath = configPath(env), fsImpl = fs } = {}) {
  if (!fsImpl.existsSync(filePath)) {
    fsImpl.mkdirSync(path.dirname(filePath), { recursive: true });
    fsImpl.writeFileSync(filePath, TEMPLATE, { flag: 'wx', mode: 0o600 });
    throw new Error(`Uzupełnij JARVIS_DB_PASSWORD w pliku:\n${filePath}`);
  }
  const fileValues = parseEnv(fsImpl.readFileSync(filePath, 'utf8'));
  // Explicit process env overrides local file; useful for managed test environments.
  const result = { ...DEFAULTS, ...fileValues };
  for (const key of KEYS) {
    if (Object.hasOwn(env, key) && env[key] !== '') result[key] = env[key];
  }
  if (!result.JARVIS_DB_PASSWORD || result.JARVIS_DB_PASSWORD === 'change_this_to_a_unique_local_password') {
    throw new Error(`Uzupełnij hasło JARVIS_DB_PASSWORD w pliku:\n${filePath}`);
  }
  if (!/^\d{2,5}$/.test(result.JARVIS_DB_PORT) || +result.JARVIS_DB_PORT < 1 || +result.JARVIS_DB_PORT > 65535) {
    throw new Error('Niepoprawny JARVIS_DB_PORT.');
  }
  if (!['127.0.0.1', 'localhost'].includes(result.JARVIS_DB_HOST)) {
    throw new Error('Na tym etapie baza danych musi działać lokalnie (127.0.0.1).');
  }
  return result;
}

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

function createBackendRuntime({
  jarPath,
  javaBin = process.env.JARVIS_JAVA_BIN || 'java',
  env = process.env,
  spawnImpl = spawn,
  fetchImpl = globalThis.fetch,
  fsImpl = fs,
  filePath,
  now = Date.now,
  sleepImpl = sleep,
  maxWaitMs = 60000,
} = {}) {
  if (typeof fetchImpl !== 'function') throw new TypeError('fetch is required');
  let ownedProcess = null;
  let startPromise = null;
  let shuttingDown = false;

  async function request(url, token, signal) {
    try {
      const response = await fetchImpl(url, {
        method: 'GET',
        headers: token ? { 'X-Jarvis-Session': token } : {},
        redirect: 'error',
        signal,
      });
      return response.status;
    } catch {
      return 0;
    }
  }

  async function checkPort() {
    // A live HTTP server on port 8080 is not our child; refuse to take it over.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1500);
    try { return await request(HEALTH_URL, null, controller.signal); }
    finally { clearTimeout(timer); }
  }

  async function doStart() {
    if (shuttingDown) throw new Error('Backend is shutting down.');
    if (!jarPath || !fsImpl.existsSync(jarPath)) {
      throw new Error('Brakuje zapakowanego backendu Java. Zbuduj instalator poleceniem npm run installer:full.');
    }
    const db = readDatabaseConfig({ env, filePath: filePath ?? configPath(env), fsImpl });
    const occupied = await checkPort();
    if (occupied !== 0) {
      throw new Error(`Port 8080 jest już zajęty (HTTP ${occupied}). Zamknij inny backend przed uruchomieniem Jarvisa.`);
    }
    const token = env.JARVIS_SESSION_TOKEN || crypto.randomBytes(32).toString('hex');
    // The Electron main chat IPC reads this value; renderer never receives it.
    env.JARVIS_SESSION_TOKEN = token;

    const child = spawnImpl(javaBin, [
      '-jar', jarPath,
      '--server.address=127.0.0.1',
      '--server.port=8080',
    ], {
      cwd: path.dirname(jarPath),
      env: { ...env, ...db, JARVIS_SESSION_TOKEN: token },
      shell: false,
      windowsHide: true,
      stdio: ['ignore', 'ignore', 'ignore'],
    });
    ownedProcess = child;
    let processError = null;
    let exited = false;
    child.once('error', error => { processError = error; exited = true; });
    child.once('exit', () => { exited = true; });
    const deadline = now() + maxWaitMs;
    while (now() < deadline) {
      if (shuttingDown) throw new Error('Zatrzymano uruchamianie backendu.');
      if (exited) {
        const detail = processError?.code === 'ENOENT'
          ? 'Nie znaleziono Java. Zainstaluj Java 21 i dodaj java.exe do PATH.'
          : 'Proces backendu zakończył działanie. Sprawdź PostgreSQL i konfigurację backend.env.';
        throw new Error(detail);
      }
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 1200);
      let code;
      try { code = await request(API_URL, token, controller.signal); }
      finally { clearTimeout(timer); }
      if (code === 200) return { started: true };
      if (code === 401 || code === 403) {
        throw new Error('Backend odrzuca token sesji (401/403). Sprawdź konfigurację Spring Security.');
      }
      await sleepImpl(350);
    }
    throw new Error('Backend Java nie uruchomił się w wyznaczonym czasie. Sprawdź PostgreSQL i Java 21.');
  }

  async function start() {
    if (startPromise) return startPromise;
    startPromise = doStart().catch(error => { stop(); startPromise = null; throw error; });
    return startPromise;
  }

  function stop() {
    shuttingDown = true;
    if (ownedProcess && !ownedProcess.killed) {
      try { ownedProcess.kill(); } catch { /* already exited */ }
    }
    ownedProcess = null;
  }

  return { start, stop };
}

let manager = null;
async function startPackagedBackend({ resourcesPath } = {}) {
  if (manager) return manager.start();
  const jarPath = path.join(resourcesPath, 'backend', 'jarvis-backend.jar');
  manager = createBackendRuntime({ jarPath });
  return manager.start();
}
function stopPackagedBackend() {
  manager?.stop();
  manager = null;
}

module.exports = {
  API_URL, HEALTH_URL, TEMPLATE, configPath, parseEnv, readDatabaseConfig,
  createBackendRuntime, startPackagedBackend, stopPackagedBackend,
};
