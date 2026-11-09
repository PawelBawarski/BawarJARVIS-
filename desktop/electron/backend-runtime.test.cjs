'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const EventEmitter = require('node:events');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  parseEnv, readDatabaseConfig, createBackendRuntime,
} = require('./backend-runtime.cjs');

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

test('config creates a template and refuses to run without password', () => {
  const f = fixture();
  try {
    fs.unlinkSync(f.config);
    assert.throws(() => readDatabaseConfig({ env: f.env, filePath: f.config }), /JARVIS_DB_PASSWORD/);
    assert.match(fs.readFileSync(f.config, 'utf8'), /JARVIS_DB_PASSWORD=/);
  } finally { f.cleanup(); }
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
    manager.stop();
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
