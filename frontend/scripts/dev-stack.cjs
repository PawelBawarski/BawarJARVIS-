'use strict';
/** One-command local developer stack. Requires a running PostgreSQL instance. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const http = require('node:http');
const { spawn, spawnSync } = require('node:child_process');
const { modelConfig, llamaArgs, ensurePortFree, waitForModelReady } = require('./model-runtime.cjs');
const frontend = path.resolve(__dirname, '..');
const backend = path.resolve(frontend, '..', 'backend');
const useElectron = process.argv.includes('--electron');
const useAi = process.argv.includes('--ai');

function readLocalDbSettings() {
  const result = {};
  const file = path.join(backend, '.env.jarvis');
  if (fs.existsSync(file)) {
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const found = line.match(/^\s*(JARVIS_DB_(?:HOST|PORT|NAME|USER|PASSWORD))=(.*)\s*$/);
      if (!found) continue;
      let value = found[2].trim();
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
      result[found[1]] = value;
    }
  }
  return { ...result, ...Object.fromEntries(Object.entries(process.env)
    .filter(([key]) => key.startsWith('JARVIS_DB_'))) };
}

if (!fs.existsSync(path.join(backend, 'pom.xml'))) {
  console.error('Brak backend/pom.xml. Uruchom w repozytorium BawarJARVIS-.');
  process.exit(1);
}
const settings = readLocalDbSettings();
if (!settings.JARVIS_DB_PASSWORD) {
  console.error('Ustaw JARVIS_DB_PASSWORD lub backend/.env.jarvis (nie dodawaj sekretów do Git).');
  process.exit(1);
}
const env = {
  ...process.env,
  ...settings,
  // One ephemeral session per developer launch, shared only with backend and dev proxy.
  JARVIS_SESSION_TOKEN: crypto.randomBytes(32).toString('hex'),
};
const children = [];
let stopping = false;

function stop(code) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  for (const child of children) {
    if (!child.pid || child.exitCode !== null) continue;
    if (process.platform === 'win32') {
      spawnSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    } else child.kill('SIGTERM');
  }
}
function start(program, args, cwd, label, childEnv = env) {
  const child = spawn(program, args, { cwd, env: childEnv, stdio: 'inherit', windowsHide: false });
  children.push(child);
  child.once('error', error => { console.error(label, error.message); stop(1); });
  child.once('exit', code => { if (!stopping) { console.error(`${label} zakończył działanie: ${code}`); stop(code || 1); } });
  return child;
}

process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));

async function boot() {
  if (useAi) {
    // Paths are explicit; no remote downloads and no implicit reuse of another server.
    const config = modelConfig(process.env, frontend);
    await ensurePortFree();
    const key = crypto.randomBytes(32).toString('hex');
    env.JARVIS_LLM_API_KEY = key;
    start(config.binary, llamaArgs(config), frontend, 'Qwen3 (llama.cpp)', {
      ...process.env, LLAMA_API_KEY: key,
    });
    console.log('Uruchamianie lokalnego Qwen3; oczekiwanie na /health...');
    await waitForModelReady({ apiKey: key, isStopped: () => stopping });
    if (stopping) return;
    console.log('Qwen3 gotowy (127.0.0.1:8765).');
  }
  if (stopping) return;
  const win = process.platform === 'win32';
  start(win ? 'cmd.exe' : path.join(backend, 'mvnw'),
    win ? ['/d', '/c', 'mvnw.cmd', 'spring-boot:run'] : ['spring-boot:run'], backend, 'Spring Boot');
  start(process.execPath, [path.join(frontend, 'node_modules', '@angular', 'cli', 'bin', 'ng.js'),
    'serve', '--host', '127.0.0.1', '--port', '4200', '--proxy-config', 'proxy.conf.cjs'], frontend, 'Angular',
    { ...process.env, JARVIS_SESSION_TOKEN: env.JARVIS_SESSION_TOKEN });

  if (useElectron) {
    function probe() {
      if (stopping) return;
      http.get('http://127.0.0.1:4200/', response => {
        response.resume();
        if (response.statusCode !== 200) return setTimeout(probe, 500);
        let executable;
        try { executable = require('electron'); }
        catch { console.error('Zainstaluj Electron: npm install -D electron'); return stop(1); }
        start(executable, [path.join(frontend, 'electron', 'main.cjs')], frontend, 'Electron',
          { ...process.env });
      }).on('error', () => { if (!stopping) setTimeout(probe, 500); });
    }
    probe();
  }
}
boot().catch(error => { console.error('JARVIS DEV:', error.message); stop(1); });
