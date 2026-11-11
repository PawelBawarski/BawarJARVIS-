'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const EventEmitter = require('node:events');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  configPath, parseEnv, readDatabaseConfig, createBackendRuntime,
} = require('./backend-runtime.cjs');
const { createRuntimeLifecycle } = require('./runtime-lifecycle.cjs');

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-backend-test-'));
  const config = path.join(root, 'backend.env');
  const jar = path.join(root, 'jarvis-backend.jar');
  fs.writeFileSync(jar, 'fake jar');
  fs.writeFileSync(config, 'JARVIS_DB_PASSWORD=secret\nJARVIS_DB_PORT=5433\n');
  const env = { APPDATA: root };
  return { root, config, jar, env, cleanup() { fs.rmSync(root, { recursive: true, force: true }); } };
}

function spawned() {
  const proc = new EventEmitter();
  proc.killed = false;
  proc.kill = () => { proc.killed = true; proc.emit('exit', 0); return true; };
  return proc;
}
function response(status) { return { status }; }

test('parseEnv accepts Windows CRLF, quotes, comments and rejects injected keys', () => {
  assert.deepEqual(parseEnv('# header\r\nJARVIS_DB_PASSWORD="abc def"\r\nJARVIS_DB_PORT=5433\r\n'), {
    JARVIS_DB_PASSWORD: 'abc def', JARVIS_DB_PORT: '5433',
  });
  assert.throws(() => parseEnv('export JARVIS_DB_PASSWORD=foo'), /format/);
  assert.throws(() => parseEnv('JAVA_TOOL_OPTIONS=-agentlib:jdwp'), /Nieznany klucz/);
  assert.throws(() => parseEnv('JARVIS_DB_PASSWORD=a\nJARVIS_DB_PASSWORD=b'), /Zduplikowany/);
});

test('config creates an empty password template and rejects repeated reads until configured', () => {
  const f = fixture();
  try {
    fs.unlinkSync(f.config);
    assert.throws(() => readDatabaseConfig({ env: f.env, filePath: f.config }), /JARVIS_DB_PASSWORD/);
    const template = fs.readFileSync(f.config, 'utf8');
    assert.equal(parseEnv(template).JARVIS_DB_PASSWORD, '');
    assert.throws(() => readDatabaseConfig({ env: f.env, filePath: f.config }), /JARVIS_DB_PASSWORD/);
    assert.equal(fs.readFileSync(f.config, 'utf8'), template);
  } finally { f.cleanup(); }
});

test('default config reads JarvisData and passes its database settings to Java without touching legacy data', async () => {
  const f = fixture();
  const child = spawned();
  const currentFile = path.join(f.root, 'JarvisData', 'backend.env');
  const legacyFile = path.join(f.root, 'J.A.R.V.I.S.', 'backend.env');
  const current = 'JARVIS_DB_HOST=127.0.0.1\nJARVIS_DB_PORT=55432\nJARVIS_DB_NAME=jarvis_db\nJARVIS_DB_USER=jarvis\nJARVIS_DB_PASSWORD=current-test-only\n';
  const legacy = 'LEGACY_CONFIGURATION_DO_NOT_USE=1\n';
  fs.mkdirSync(path.dirname(currentFile), { recursive: true });
  fs.mkdirSync(path.dirname(legacyFile), { recursive: true });
  fs.writeFileSync(currentFile, current);
  fs.writeFileSync(legacyFile, legacy);
  let childEnv;
  const runtime = createBackendRuntime({
    jarPath: f.jar, env: f.env,
    spawnImpl: (_exe, _args, options) => { childEnv = options.env; return child; },
    fetchImpl: async url => response(url.includes('health') ? 0 : 200),
  });
  try {
    assert.equal(configPath(f.env), currentFile);
    assert.equal(readDatabaseConfig({ env: f.env }).JARVIS_DB_PORT, '55432');
    await runtime.start();
    assert.equal(childEnv.JARVIS_DB_PORT, '55432');
    assert.equal(childEnv.JARVIS_DB_PASSWORD, 'current-test-only');
    assert.equal(childEnv.JARVIS_DB_HOST, '127.0.0.1');
    assert.equal(childEnv.JARVIS_DB_NAME, 'jarvis_db');
    assert.equal(fs.readFileSync(currentFile, 'utf8'), current);
    assert.equal(fs.readFileSync(legacyFile, 'utf8'), legacy);
  } finally { await runtime.stop(); f.cleanup(); }
});

test('config never accepts non-loopback database host', () => {
  const f = fixture();
  try {
    fs.appendFileSync(f.config, 'JARVIS_DB_HOST=8.8.8.8\n');
    assert.throws(() => readDatabaseConfig({ env: f.env, filePath: f.config }), /lokalnie/);
  } finally { f.cleanup(); }
});

test('launches one local Java process with token in child env, and stops only owned process', async () => {
  const f = fixture();
  const child = spawned();
  let invocation;
  let count = 0;
  const manager = createBackendRuntime({
    jarPath: f.jar, env: f.env, filePath: f.config,
    spawnImpl: (...args) => { invocation = args; return child; },
    fetchImpl: async url => response(url.includes('health') ? 0 : (++count > 1 ? 200 : 0)),
    sleepImpl: async () => {},
  });
  try {
    const [a,b] = await Promise.all([manager.start(), manager.start()]);
    assert.deepEqual(a, b);
    assert.equal(invocation[0], 'java');
    assert.deepEqual(invocation[1], ['-jar', f.jar, '--server.address=127.0.0.1', '--server.port=8080']);
    assert.match(invocation[2].env.JARVIS_SESSION_TOKEN, /^[a-f0-9]{64}$/);
    assert.equal(f.env.JARVIS_SESSION_TOKEN, invocation[2].env.JARVIS_SESSION_TOKEN);
    assert.equal(invocation[2].env.JARVIS_DB_PASSWORD, 'secret');
    assert.equal(child.killed, false);
    await manager.stop();
    assert.equal(child.killed, true);
  } finally { f.cleanup(); }
});

test('refuses to start when another HTTP service already owns 8080', async () => {
  const f = fixture();
  let calls = 0;
  const manager = createBackendRuntime({
    jarPath: f.jar, env: f.env, filePath: f.config,
    spawnImpl: () => { calls++; return spawned(); },
    fetchImpl: async () => response(401),
  });
  try {
    await assert.rejects(manager.start(), /Port 8080/);
    assert.equal(calls, 0);
  } finally { f.cleanup(); }
});

test('fails closed for 401/403 and stops the Java child', async () => {
  const f = fixture();
  const child = spawned();
  const manager = createBackendRuntime({
    jarPath: f.jar, env: f.env, filePath: f.config,
    spawnImpl: () => child,
    fetchImpl: async url => response(url.includes('health') ? 0 : 403),
    sleepImpl: async () => {},
  });
  try {
    await assert.rejects(manager.start(), /401\/403/);
    assert.equal(child.killed, true);
  } finally { f.cleanup(); }
});

test('refuses missing backend JAR and never spawns Java', async () => {
  const f = fixture();
  let calls = 0;
  const manager = createBackendRuntime({
    jarPath: path.join(f.root, 'missing.jar'), env: f.env,
    filePath: f.config, spawnImpl: () => { calls++; return spawned(); },
  });
  try {
    await assert.rejects(manager.start(), /zapakowanego backendu/);
    assert.equal(calls, 0);
  } finally { f.cleanup(); }
});

test('Java ENOENT is handled and reported without hanging', async () => {
  const f = fixture();
  const child = spawned();
  let simulated = false;
  const manager = createBackendRuntime({
    jarPath: f.jar, env: f.env, filePath: f.config,
    spawnImpl: () => child,
    fetchImpl: async url => response(url.includes('health') ? 0 : 0),
    sleepImpl: async () => { if (!simulated) { simulated = true; child.emit('error', Object.assign(new Error('missing'), { code: 'ENOENT' })); } },
  });
  try {
    await assert.rejects(manager.start(), /Java 21/);
    assert.equal(child.killed, true);
  } finally { f.cleanup(); }
});

for (const event of ['exit', 'close']) {
  test(`stop waits for Java ${event} and coalesces repeated shutdown requests`, async () => {
    const f = fixture();
    const child = spawned();
    let kills = 0;
    child.kill = () => { kills++; child.killed = true; return true; };
    const runtime = createBackendRuntime({
      jarPath: f.jar, env: f.env, filePath: f.config,
      spawnImpl: () => child,
      fetchImpl: async url => response(url.includes('health') ? 0 : 200),
    });
    try {
      await runtime.start();
      let stopped = false;
      const stopping = runtime.stop();
      assert.equal(stopping, runtime.stop());
      void stopping.then(() => { stopped = true; });
      await Promise.resolve();
      assert.equal(stopped, false);
      assert.equal(kills, 1);
      child.emit(event, 0);
      await stopping;
      assert.equal(stopped, true);
      assert.equal(child.listenerCount('exit'), event === 'exit' ? 0 : 1);
      assert.equal(child.listenerCount('close'), event === 'close' ? 0 : 1);
    } finally { child.emit('exit', 0); await runtime.stop(); f.cleanup(); }
  });
}

test('startup failure waits for child termination before rejecting', async () => {
  const f = fixture();
  const child = spawned();
  let notifyKill;
  const killCalled = new Promise(resolve => { notifyKill = resolve; });
  child.kill = () => { child.killed = true; notifyKill(); return true; };
  const runtime = createBackendRuntime({
    jarPath: f.jar, env: f.env, filePath: f.config,
    spawnImpl: () => child,
    fetchImpl: async url => response(url.includes('health') ? 0 : 403),
  });
  let settled = false;
  const starting = runtime.start();
  const checked = assert.rejects(starting, /401\/403/).then(() => { settled = true; });
  try {
    await killCalled;
    await Promise.resolve();
    assert.equal(settled, false);
    child.emit('exit', 1);
    await checked;
    assert.equal(settled, true);
  } finally { child.emit('exit', 1); await checked; f.cleanup(); }
});

test('shutdown reports a bounded timeout when a kill request does not end the child', async () => {
  const f = fixture();
  const child = spawned();
  child.kill = () => { child.killed = true; return true; };
  const runtime = createBackendRuntime({
    jarPath: f.jar, env: f.env, filePath: f.config, stopWaitMs: 20,
    spawnImpl: () => child,
    fetchImpl: async url => response(url.includes('health') ? 0 : 200),
  });
  try {
    await runtime.start();
    await assert.rejects(runtime.stop(), /Nie potwierdzono zatrzymania backendu/);
  } finally { child.emit('exit', 0); f.cleanup(); }
});

test('shutdown while checking port never starts Java afterwards', async () => {
  const f = fixture();
  let releasePort;
  const portCheck = new Promise(resolve => { releasePort = resolve; });
  let spawns = 0;
  const runtime = createBackendRuntime({
    jarPath: f.jar, env: f.env, filePath: f.config,
    spawnImpl: () => { spawns++; return spawned(); },
    fetchImpl: async () => portCheck,
  });
  const starting = runtime.start();
  try {
    await runtime.stop();
    releasePort(response(0));
    await assert.rejects(starting, /Zatrzymano/);
    assert.equal(spawns, 0);
  } finally { releasePort(response(0)); f.cleanup(); }
});

test('quit can retry after Java shutdown times out and a late exit releases the database', async () => {
  const f = fixture();
  const child = spawned();
  child.kill = () => { child.killed = true; return true; };
  const runtime = createBackendRuntime({
    jarPath: f.jar, env: f.env, filePath: f.config, stopWaitMs: 20,
    spawnImpl: () => child,
    fetchImpl: async url => response(url.includes('health') ? 0 : 200),
  });
  let databaseStops = 0;
  const lifecycle = createRuntimeLifecycle({
    startDatabase: async () => {}, startQwen: async () => {}, startBackend: runtime.start,
    stopBackend: runtime.stop, stopQwen: async () => {},
    stopDatabase: async () => { databaseStops++; },
  });
  try {
    await lifecycle.start();
    await assert.rejects(lifecycle.stop(), /Nie potwierdzono zatrzymania backendu/);
    assert.equal(databaseStops, 0);
    child.emit('exit', 0);
    await lifecycle.stop();
    assert.equal(databaseStops, 1);
  } finally { child.emit('exit', 0); f.cleanup(); }
});
