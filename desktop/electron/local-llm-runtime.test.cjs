'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { createLocalLlmRuntime, assetPaths } = require('./local-llm-runtime.cjs');

const root = process.platform === 'win32' ? 'C:\\Jarvis' : '/tmp/Jarvis';
function processMock() {
  const p = new EventEmitter();
  p.killed = false;
  p.kill = () => { p.killed = true; p.emit('exit', 0); return true; };
  return p;
}
function create({ occupied = false, missing = false, response = 200 } = {}) {
  const env = {};
  const child = processMock();
  let calls = 0;
  let spawned = null;
  const runtime = createLocalLlmRuntime({
    resourcesPath: root, env,
    makeToken: () => 'a'.repeat(64),
    fsImpl: { existsSync: () => !missing },
    fetchImpl: async () => ({ status: occupied ? 200 : (++calls === 1 ? 0 : response) }),
    spawnImpl: (...args) => { spawned = args; return child; },
    sleepImpl: async () => {},
    maxWaitMs: 300,
  });
  return { env, child, runtime, get spawned() { return spawned; } };
}

test('locates exe and model strictly under packaged resources', () => {
  const p = assetPaths(root);
  assert.match(p.exe, /llama-server\.exe$/);
  assert.match(p.model, /Qwen3-8B-Q4_K_M\.gguf$/);
  assert.throws(() => assetPaths('relative'));
});
test('starts one owned process without exposing key through argv', async () => {
  const f = create();
  const [a, b] = await Promise.all([f.runtime.start(), f.runtime.start()]);
  assert.deepEqual(a, b);
  assert.equal(f.spawned[2].shell, false);
  assert.equal(f.spawned[2].env.LLAMA_API_KEY, 'a'.repeat(64));
  assert.equal(f.env.JARVIS_LLM_API_KEY, 'a'.repeat(64));
  assert.equal(f.spawned[1].includes('a'.repeat(64)), false);
  assert.equal(f.spawned[1].includes('127.0.0.1'), true);
  assert.equal(f.spawned[1].includes('--sleep-idle-seconds'), true);
  f.runtime.stop();
  assert.equal(f.child.killed, true);
  assert.equal(f.env.JARVIS_LLM_API_KEY, undefined);
});
test('refuses missing assets and does not spawn', async () => {
  const f = create({ missing: true });
  await assert.rejects(f.runtime.start(), /Brakuje plików/);
  assert.equal(f.spawned, null);
});
test('refuses any pre-existing port listener', async () => {
  const f = create({ occupied: true });
  await assert.rejects(f.runtime.start(), /Port 8765/);
  assert.equal(f.spawned, null);
});
test('recognizes model-loading health status 503 before ready', async () => {
  const f = create({ response: 200 });
  assert.deepEqual(await f.runtime.start(), { started: true });
  f.runtime.stop();
});
