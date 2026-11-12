"use strict";
/** Developer-only local llama.cpp process contract. No downloads or remote services. */
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');

const PORT = 8765;
const ALIAS = 'jarvis-qwen3-8b';
const CONFIG_KEYS = new Set([
  'JARVIS_LLAMA_SERVER_PATH', 'JARVIS_GGUF_PATH', 'JARVIS_GPU_LAYERS', 'JARVIS_CTX_SIZE',
]);

function readModelSettings(file) {
  if (!fs.existsSync(file)) return {};
  const config = {};
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (!line.trim() || /^\s*#/.test(line)) continue;
    const match = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match || !CONFIG_KEYS.has(match[1])) throw new Error('Nieprawidlowe ustawienie w .env.model.local.');
    let value = match[2];
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    config[match[1]] = value;
  }
  return config;
}

function windowsGitBashPath(value, platform = process.platform) {
  if (platform === 'win32' && /^\/[a-zA-Z]\//.test(value)) {
    return value[1].toUpperCase() + ':/' + value.slice(3);
  }
  return value;
}

function integerSetting(value, fallback, min, max, name) {
  if (value === undefined || value === '') return fallback;
  if (!/^\d+$/.test(String(value))) throw new Error(`${name}: wymagane liczba calkowita.`);
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < min || number > max)
    throw new Error(`${name}: poza zakresem ${min}-${max}.`);
  return number;
}

function modelConfig(inputEnv, frontendDir, fileSystem = fs, platform = process.platform) {
  const settings = {
    ...readModelSettings(path.join(frontendDir, '.env.model.local')),
    ...Object.fromEntries(Object.entries(inputEnv).filter(([key, val]) =>
      CONFIG_KEYS.has(key) && val !== undefined)),
  };
  const binary = windowsGitBashPath(settings.JARVIS_LLAMA_SERVER_PATH || '', platform);
  const model = windowsGitBashPath(settings.JARVIS_GGUF_PATH || '', platform);
  if (!path.isAbsolute(binary) || !path.isAbsolute(model))
    throw new Error('Ustaw pelne sciezki JARVIS_LLAMA_SERVER_PATH i JARVIS_GGUF_PATH (Windows: C:/...).');
  const allowedExecutable = platform === 'win32' ? 'llama-server.exe' : 'llama-server';
  if (path.basename(binary).toLowerCase() !== allowedExecutable ||
      path.extname(model).toLowerCase() !== '.gguf') {
    throw new Error('Wymagany llama-server(.exe) i lokalny plik .gguf.');
  }
  for (const [label, fullPath] of [['llama-server', binary], ['GGUF', model]]) {
    let stat;
    try { stat = fileSystem.statSync(fullPath); }
    catch { throw new Error(`Nie znaleziono ${label}: ${fullPath}`); }
    if (!stat.isFile()) throw new Error(`${label} nie jest plikiem: ${fullPath}`);
  }
  return {
    binary,
    model,
    ctxSize: integerSetting(settings.JARVIS_CTX_SIZE, 4096, 512, 32768, 'JARVIS_CTX_SIZE'),
    gpuLayers: integerSetting(settings.JARVIS_GPU_LAYERS, 0, 0, 999, 'JARVIS_GPU_LAYERS'),
  };
}

function llamaArgs(config) {
  return [
    '--model', config.model,
    '--host', '127.0.0.1', '--port', String(PORT),
    '--alias', ALIAS, '--ctx-size', String(config.ctxSize),
    '--n-gpu-layers', String(config.gpuLayers),
    '--offline', '--no-webui',
  ];
}

async function ensurePortFree(port = PORT) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', err => reject(
      err.code === 'EADDRINUSE' ? new Error(`Port ${port} jest zajety. Nie podpinamy sie pod obcy model.`) : err));
    server.listen(port, '127.0.0.1', () => server.close(resolve));
  });
}

async function waitForModelReady({
  apiKey, port = PORT, timeoutMs = 180_000, intervalMs = 1000,
  fetchImpl = fetch, isStopped = () => false, sleep = ms => new Promise(r => setTimeout(r, ms)),
} = {}) {
  if (!apiKey) throw new Error('Brak lokalnego klucza modelu.');
  const deadline = Date.now() + timeoutMs;
  const base = `http://127.0.0.1:${port}`;
  while (Date.now() < deadline && !isStopped()) {
    try {
      const health = await fetchImpl(`${base}/health`, { signal: AbortSignal.timeout(2000) });
      if (health.status === 200) {
        const models = await fetchImpl(`${base}/v1/models`, {
          headers: { Authorization: `Bearer ${apiKey}` },
          signal: AbortSignal.timeout(2000),
        });
        if (!models.ok) throw new Error(`Model odmowil autoryzacji (HTTP ${models.status}).`);
        const body = await models.json();
        if (!Array.isArray(body.data) || !body.data.some(item => item.id === ALIAS))
          throw new Error('Dziala inny model niz jarvis-qwen3-8b.');
        return;
      }
      if (health.status !== 503) throw new Error(`llama-server /health HTTP ${health.status}.`);
    } catch (err) {
      if (err.message?.includes('odmowil autoryzacji') || err.message?.includes('inny model') ||
          err.message?.includes('llama-server /health')) throw err;
      // ECONNREFUSED while the model is loading is expected.
    }
    await sleep(intervalMs);
  }
  throw new Error(isStopped() ? 'Przerwano start modelu.' : 'Qwen nie osiagnal gotowosci w limicie czasu.');
}

module.exports = { PORT, ALIAS, readModelSettings, windowsGitBashPath,
  modelConfig, llamaArgs, ensurePortFree, waitForModelReady };
