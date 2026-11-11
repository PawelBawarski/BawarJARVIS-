'use strict';
// J.A.R.V.I.S. 17.6.2 first-run model
const { ensureFirstRunModel, cancelFirstRunModel } = require('./qwen-first-run.cjs');
// J.A.R.V.I.S. 17.5 persistent GGUF
const { resolveVerifiedQwenModel } = require('./qwen-model-path.cjs');
/** Stage 17.4. Packaged Electron MAIN owns the Qwen/llama.cpp process.
 * No commands, models or keys may be supplied by the renderer. Never execute a shell.
 */
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');

const PORT = 8765;
const HOST = '127.0.0.1';
const HEALTH_URL = `http://${HOST}:${PORT}/health`;
const AUTH_URL = `http://${HOST}:${PORT}/tokenize`;
const EXE = 'llama-server.exe';
const MODEL = 'Qwen3-8B-Q4_K_M.gguf';

function regularNoSymlink(file, fsImpl = fs) {
  let current = path.parse(path.resolve(file)).root;
  const parts = path.relative(current, path.resolve(file)).split(path.sep);
  for (const segment of parts) {
    if (!segment) continue;
    current = path.join(current, segment);
    const stat = fsImpl.lstatSync(current);
    if (stat.isSymbolicLink()) throw new Error('Niedozwolony symlink w zasobach Qwen.');
  }
  if (!fsImpl.statSync(file).isFile()) throw new Error('Nieprawidłowy plik Qwen.');
}

function resolveQwenAssets(resourcesPath, fsImpl = fs, platform = process.platform) {
  if (platform !== 'win32' || typeof resourcesPath !== 'string' || !path.isAbsolute(resourcesPath)) {
    throw new Error('Qwen 17.4: wymagane zasoby spakowanej aplikacji Windows.');
  }
  const binary = path.join(resourcesPath, 'llm', 'bin', EXE);
  const bundledModel = path.join(resourcesPath, 'llm', 'models', MODEL);
  const model = fsImpl.existsSync(bundledModel) ? bundledModel :
    resolveVerifiedQwenModel({ resourcesPath, fsImpl, platform });
  try { regularNoSymlink(binary, fsImpl); regularNoSymlink(model, fsImpl); }
  catch (error) {
    if (error?.code === 'ENOENT') {
      throw new Error('Brak Qwen/llama-server w resources/llm. Przygotuj zasoby 17.4.');
    }
    throw error;
  }
  return { binary, model };
}

function isPortOccupied(port = PORT, host = HOST, timeoutMs = 1200) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ port, host });
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => { socket.destroy(); resolve(true); });
    socket.once('error', e => {
      socket.destroy();
      if (e.code === 'ECONNREFUSED') resolve(false);
      else reject(new Error('Nie można bezpiecznie zweryfikować portu Qwen.'));
    });
    socket.once('timeout', () => { socket.destroy(); reject(new Error('Timeout sprawdzania portu Qwen.')); });
  });
}

function restrictedChildEnv(baseEnv, apiKey) {
  const safe = {};
  for (const [key, value] of Object.entries(baseEnv)) {
    if (/^(JARVIS_DB_|SPRING_DATASOURCE_|SPRING_FLYWAY_|JARVIS_SESSION_TOKEN$|JARVIS_LLM_API_KEY$|LLAMA_API_KEY$)/i.test(key)) continue;
    safe[key] = value;
  }
  safe.LLAMA_API_KEY = apiKey; // llama.cpp reads this env var: key never appears in argv.
  return safe;
}

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

function createQwenRuntime({
  resourcesPath,
  env = process.env,
  platform = process.platform,
  fsImpl = fs,
  spawnImpl = spawn,
  fetchImpl = globalThis.fetch,
  portProbe = isPortOccupied,
  randomBytes = crypto.randomBytes,
  now = Date.now,
  sleepImpl = sleep,
  maxWaitMs = 240_000,
  stopWaitMs = 5000,
  onUnexpectedExit = () => {},
} = {}) {
  if (typeof fetchImpl !== 'function') throw new Error('Brak obsługi fetch w Electron main.');
  if (!Number.isFinite(stopWaitMs) || stopWaitMs <= 0) throw new TypeError('stopWaitMs must be positive');
  let proc = null;
  let promise = null;
  let stopPromise = null;
  let processFinished = false;
  let stopping = false;
  let ready = false;
  let terminated = false;
  let lastError = null;
  let exitNotified = false;

  async function status(url, headers, method = 'GET', body) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1500);
    try {
      const response = await fetchImpl(url, { method, body, headers, redirect: 'error', signal: controller.signal });
      return response.status;
    } catch { return 0; }
    finally { clearTimeout(timer); }
  }

  async function doStart() {
    if (stopping) throw new Error('Trwa zamykanie Qwen.');
    const { binary, model } = resolveQwenAssets(resourcesPath, fsImpl, platform);
    if (await portProbe(PORT, HOST)) {
      throw new Error('Port 8765 jest zajęty. Nie przejmuję obcego serwera Qwen.');
    }
    if (stopping) throw new Error('Anulowano uruchamianie Qwen.');
    const key = randomBytes(32).toString('hex');
    // Shared only in main -> Spring Boot child env; never sent to renderer/preload.
    env.JARVIS_LLM_API_KEY = key;
    let child;
    try {
      child = spawnImpl(binary, [
        '--model', model, '--host', HOST, '--port', String(PORT),
        '--ctx-size', '4096', '--n-gpu-layers', '99', '--parallel', '1',
        '--alias', 'jarvis-qwen3-8b', '--no-webui', '--sleep-idle-seconds', '300',
      ], {
        cwd: path.dirname(binary),
        env: restrictedChildEnv(env, key),
        shell: false,
        windowsHide: true,
        stdio: ['ignore', 'ignore', 'ignore'],
      });
    } catch (error) {
      delete env.JARVIS_LLM_API_KEY;
      throw new Error('Nie udało się uruchomić llama-server.exe.');
    }
    proc = child;
    const handleExit = () => {
      terminated = true;
      if (ready && !stopping && !exitNotified) {
        exitNotified = true;
        try { onUnexpectedExit('Lokalny model Qwen zakończył pracę. Zamknij Jarvisa i sprawdź zasoby AI/GPU.'); }
        catch { /* user notification must not crash Electron main */ }
      }
    };
    child.once('error', error => { lastError = error; handleExit(); });
    const markFinished = () => { processFinished = true; handleExit(); };
    child.once('exit', markFinished);
    child.once('close', markFinished);
    const deadline = now() + maxWaitMs;
    while (now() < deadline) {
      if (stopping) throw new Error('Anulowano uruchamianie Qwen.');
      if (terminated) {
        const message = lastError?.code === 'ENOENT'
          ? 'Brak llama-server.exe albo zależnych bibliotek DLL.'
          : 'Proces Qwen zakończył pracę przed gotowością. Sprawdź sterownik GPU i pliki llama.cpp.';
        throw new Error(message);
      }
      const health = await status(HEALTH_URL);
      if (health === 200) {
        // /health and /v1/models may be public. /tokenize is protected and performs no inference.
        const body = JSON.stringify({ content: 'jarvis' });
        const unauthed = await status(AUTH_URL, { 'Content-Type': 'application/json' }, 'POST', body);
        const authed = await status(AUTH_URL, { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` }, 'POST', body);
        if (unauthed !== 401 && unauthed !== 403) {
          throw new Error('Qwen API nie wymusza klucza. Odmawiam uruchomienia niezabezpieczonego serwera.');
        }
        if (authed !== 200) {
          throw new Error('Nie można uwierzytelnić lokalnego Qwen. Sprawdź wersję llama.cpp.');
        }
        if (stopping || terminated) throw new Error('Qwen zatrzymano podczas sprawdzania gotowości.');
        ready = true;
        return { started: true };
      }
      await sleepImpl(750);
    }
    throw new Error('Qwen nie osiągnął gotowości w 240 sekund. Sprawdź RAM/VRAM lub sterownik GPU.');
  }

  async function start() {
    if (promise) return promise;
    promise = doStart().catch(async error => {
      try {
        await stop();
      } finally {
        promise = null;
      }
      throw error;
    });
    return promise;
  }

  function stop() {
    stopping = true;
    ready = false;
    // Never keep ephemeral key after shutting down engine.
    delete env.JARVIS_LLM_API_KEY;
    if (stopPromise) return stopPromise;
    const child = proc;
    if (!child || processFinished || child.exitCode != null || child.signalCode != null) {
      proc = null;
      stopPromise = Promise.resolve();
      return stopPromise;
    }
    let resolveStop;
    let rejectStop;
    stopPromise = new Promise((resolve, reject) => { resolveStop = resolve; rejectStop = reject; })
      .catch(error => { stopPromise = null; throw error; });
    let finished = false;
    const finish = error => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      child.removeListener('exit', onExit);
      child.removeListener('close', onExit);
      if (error) rejectStop(error);
      else { proc = null; resolveStop(); }
    };
    const onExit = () => finish();
    const timer = setTimeout(() => finish(new Error('Nie potwierdzono zatrzymania Qwen w wyznaczonym czasie.')), stopWaitMs);
    child.once('exit', onExit);
    child.once('close', onExit);
    try { if (!child.killed) child.kill(); }
    catch { finish(new Error('Nie można zatrzymać własnego procesu Qwen.')); }
    return stopPromise;
  }

  return { start, stop };
}

function createQwenLifecycle({
  ensureModelImpl = ensureFirstRunModel,
  cancelModelImpl = cancelFirstRunModel,
  runtimeFactory = createQwenRuntime,
} = {}) {
  let runtime = null;
  let startPromise = null;
  let stopPromise = null;
  let stopping = false;

  function start({ resourcesPath, onUnexpectedExit } = {}) {
    if (stopping) return Promise.reject(new Error('Trwa zamykanie Qwen.'));
    if (startPromise) return startPromise;
    startPromise = (async () => {
      await ensureModelImpl({ resourcesPath });
      // Provisioning can finish after quit, even when cancellation was requested.
      if (stopping) throw new Error('Anulowano uruchamianie Qwen.');
      runtime = runtimeFactory({ resourcesPath, onUnexpectedExit });
      return runtime.start();
    })();
    return startPromise;
  }

  function stop() {
    if (stopPromise) return stopPromise;
    stopping = true;
    // A pending native selection dialog must not delay quit. The guard above
    // prevents a late model result from creating a process after shutdown.
    stopPromise = (async () => {
      cancelModelImpl();
      await runtime?.stop();
    })().catch(error => { stopPromise = null; throw error; });
    return stopPromise;
  }
  return { start, stop };
}

const packagedLifecycle = createQwenLifecycle();
function startPackagedQwen(options) { return packagedLifecycle.start(options); }
function stopPackagedQwen() {
  return packagedLifecycle.stop();
}

module.exports = {
  PORT, HOST, HEALTH_URL, AUTH_URL, resolveQwenAssets, isPortOccupied,
  restrictedChildEnv, createQwenRuntime, createQwenLifecycle, startPackagedQwen, stopPackagedQwen,
};
