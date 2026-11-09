'use strict';

/** Electron MAIN process only. Runs a bundled llama.cpp server on loopback. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { setTimeout: delay } = require('node:timers/promises');

const HOST = 'http://127.0.0.1:8765';
const MODEL_FILENAME = 'Qwen3-8B-Q4_K_M.gguf';

function assetPaths(resourcesPath) {
  if (!path.isAbsolute(resourcesPath)) throw new Error('Invalid resources path');
  const root = path.join(resourcesPath, 'llm');
  return { exe: path.join(root, 'bin', 'llama-server.exe'), model: path.join(root, 'models', MODEL_FILENAME) };
}

function createLocalLlmRuntime({ resourcesPath, env = process.env, spawnImpl = spawn,
  fsImpl = fs, fetchImpl = globalThis.fetch, sleepImpl = delay, maxWaitMs = 240000,
  now = Date.now, makeToken = () => crypto.randomBytes(32).toString('hex') } = {}) {
  const { exe, model } = assetPaths(resourcesPath);
  let child = null;
  let starting = null;
  let stopped = false;

  async function health() {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1200);
    try { const result = await fetchImpl(`${HOST}/health`, { signal: controller.signal, redirect: 'error' }); return result.status; }
    catch { return 0; }
    finally { clearTimeout(timer); }
  }

  async function launch() {
    if (stopped) throw new Error('Silnik AI jest zatrzymywany.');
    if (!fsImpl.existsSync(exe) || !fsImpl.existsSync(model)) {
      throw new Error('Brakuje plików lokalnego Qwen3 8B. Uruchom tools/local-ai/prepare_assets.py i dołącz zasoby do instalatora.');
    }
    // Never silently connect to a server we do not own, even if it looks healthy.
    if (await health() !== 0) throw new Error('Port 8765 jest zajęty. Zamknij inny proces na tym porcie.');
    const token = makeToken();
    if (!/^[a-f0-9]{64}$/.test(token)) throw new Error('Invalid local model token');
    const args = [
      '--model', model, '--host', '127.0.0.1', '--port', '8765',
      '--ctx-size', '4096', '--n-gpu-layers', '99', '--parallel', '1',
      '--alias', 'jarvis-qwen3-8b', '--no-webui', '--sleep-idle-seconds', '300',
    ];
    child = spawnImpl(exe, args, {
      cwd: path.dirname(exe),
      env: { ...env, LLAMA_API_KEY: token },
      windowsHide: true, shell: false, stdio: ['ignore', 'ignore', 'ignore'],
    });
    let error = null;
    let exited = false;
    child.once('error', e => { error = e; exited = true; });
    child.once('exit', () => { exited = true; });
    const deadline = now() + maxWaitMs;
    while (now() < deadline) {
      if (stopped) throw new Error('Zatrzymano start AI.');
      if (exited) throw new Error('Lokalny model zakończył pracę. Sprawdź zasoby VRAM i sterowniki NVIDIA.' + (error?.code === 'ENOENT' ? ' Brakuje pliku EXE.' : ''));
      const code = await health();
      if (code === 200) {
        env.JARVIS_LLM_API_KEY = token; // inherited only by the Java child, never renderer.
        return { started: true };
      }
      if (code !== 0 && code !== 503) throw new Error('Nieoczekiwana odpowiedź AI na porcie 8765.');
      await sleepImpl(500);
    }
    throw new Error('Przekroczono limit uruchamiania Qwen3 8B.');
  }

  function start() {
    if (!starting) starting = launch().catch(e => { stop(); throw e; });
    return starting;
  }
  function stop() {
    stopped = true;
    if (child && !child.killed) { try { child.kill(); } catch { /* already gone */ } }
    child = null;
    delete env.JARVIS_LLM_API_KEY;
  }
  return { start, stop };
}

let runtime = null;
function startPackagedLlm({ resourcesPath } = {}) {
  if (!runtime) runtime = createLocalLlmRuntime({ resourcesPath });
  return runtime.start();
}
function stopPackagedLlm() {
  runtime?.stop();
  runtime = null;
}
module.exports = { HOST, MODEL_FILENAME, assetPaths, createLocalLlmRuntime, startPackagedLlm, stopPackagedLlm };
