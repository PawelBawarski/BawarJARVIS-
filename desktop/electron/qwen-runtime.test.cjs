'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const {
  resolveQwenAssets, restrictedChildEnv, createQwenRuntime, createQwenLifecycle,
} = require('./qwen-runtime.cjs');

function fixtures(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis17-4-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'llm', 'bin'), { recursive: true });
  fs.mkdirSync(path.join(root, 'llm', 'models'), { recursive: true });
  fs.writeFileSync(path.join(root, 'llm', 'bin', 'llama-server.exe'), 'MZmock');
  fs.writeFileSync(path.join(root, 'llm', 'models', 'Qwen3-8B-Q4_K_M.gguf'), 'GGUFmock');
  return root;
}

function create(t, overrides = {}) {
  const resourcesPath = fixtures(t);
  const events = new EventEmitter();
  const calls = [];
  events.killed = false;
  events.kill = () => { events.killed = true; events.emit('exit', 0); };
  const env = { APPDATA: 'appdata', JARVIS_DB_PASSWORD: 'private-db', JARVIS_SESSION_TOKEN: 'private-session', PATH: 'C:\\Windows' };
  let time = 0;
  const options = {
    resourcesPath, platform: 'win32', env,
    spawnImpl: (bin, args, options) => { calls.push({bin, args, options}); return events; },
    fetchImpl: async (url, options) => {
      if (url.endsWith('/health')) return { status: 200 };
      if (url.endsWith('/tokenize')) return { status: options.headers?.Authorization ? 200 : 401 };
      throw new Error('Bad URL');
    },
    portProbe: async () => false,
    randomBytes: () => Buffer.alloc(32, 12),
    now: () => time,
    sleepImpl: async ms => { time += ms; },
    maxWaitMs: 3000,
    ...overrides,
  };
  return { runtime: createQwenRuntime(options), events, calls, env, root: resourcesPath };
}

test('resolves only Windows packaged LLM resources', (t) => {
  const root = fixtures(t);
  assert.match(resolveQwenAssets(root, fs, 'win32').binary, /llama-server\.exe$/);
  assert.throws(() => resolveQwenAssets(root, fs, 'linux'), /Windows/);
  assert.throws(() => resolveQwenAssets('relative', fs, 'win32'), /Windows/);
});

test('rejects absent/redirected assets without launching', (t) => {
  const root = fixtures(t);
  fs.rmSync(path.join(root, 'llm', 'bin', 'llama-server.exe'));
  assert.throws(() => resolveQwenAssets(root, fs, 'win32'), /Brak Qwen/);
});

test('sanitizes secret env to llama subprocess', () => {
  const got = restrictedChildEnv({
    PATH:'ok', JARVIS_DB_PASSWORD: 'db', JARVIS_SESSION_TOKEN:'session',
    SPRING_DATASOURCE_PASSWORD:'spring', JARVIS_LLM_API_KEY:'stale', LLAMA_API_KEY:'stale2',
  }, 'private');
  assert.deepEqual(got, { PATH:'ok', LLAMA_API_KEY:'private' });
});

test('starts owned server on localhost, env key not argv, then stops cleanly', async (t) => {
  const x = create(t);
  assert.deepEqual(await x.runtime.start(), { started: true });
  assert.equal(x.calls.length, 1);
  assert.equal(x.calls[0].options.shell, false);
  assert.equal(x.calls[0].options.windowsHide, true);
  assert.ok(x.calls[0].args.includes('127.0.0.1'));
  assert.ok(x.calls[0].args.includes('8765'));
  assert.ok(!x.calls[0].args.includes(x.env.JARVIS_LLM_API_KEY));
  assert.equal(x.calls[0].options.env.LLAMA_API_KEY, x.env.JARVIS_LLM_API_KEY);
  assert.equal(x.calls[0].options.env.JARVIS_DB_PASSWORD, undefined);
  assert.equal(x.calls[0].options.env.JARVIS_SESSION_TOKEN, undefined);
  await x.runtime.stop();
  assert.equal(x.events.killed, true);
  assert.equal(x.env.JARVIS_LLM_API_KEY, undefined);
});

test('waits through loading 503 before ready', async (t) => {
  let healthCount = 0;
  const x = create(t, { fetchImpl: async (url, options) => {
    if (url.endsWith('/health')) return { status: ++healthCount < 3 ? 503 : 200 };
    return { status: options.headers?.Authorization ? 200 : 401 };
  }});
  await x.runtime.start();
  assert.equal(healthCount, 3);
});

test('occupied 8765 rejects foreign service; never spawn', async (t) => {
  const x = create(t, { portProbe: async () => true });
  await assert.rejects(x.runtime.start(), /8765 jest zajęty/);
  assert.equal(x.calls.length, 0);
});

test('rejects server that does not enforce the auth key and kills it', async (t) => {
  const x = create(t, { fetchImpl: async () => ({ status: 200 }) });
  await assert.rejects(x.runtime.start(), /nie wymusza klucza/);
  assert.equal(x.events.killed, true);
});

test('rejects incorrect bearer credential and kills server', async (t) => {
  const x = create(t, { fetchImpl: async (url, opts) => {
    if (url.endsWith('/health')) return { status: 200 };
    return { status: opts.headers?.Authorization ? 403 : 401 };
  }});
  await assert.rejects(x.runtime.start(), /uwierzytelnić/);
  assert.equal(x.events.killed, true);
});

test('early exit rejects without leaving secret key', async (t) => {
  let child;
  const x = create(t, { spawnImpl: (...args) => {
    child = new EventEmitter(); child.killed=false; child.kill=() => {child.killed=true;};
    return child;
  }, fetchImpl: async () => { child.emit('exit', 1); return { status: 503 }; } });
  await assert.rejects(x.runtime.start(), /zakończył pracę/);
  assert.equal(x.env.JARVIS_LLM_API_KEY, undefined);
});

test('unexpected exit after ready calls monitor exactly once', async (t) => {
  const messages = [];
  const x = create(t, { onUnexpectedExit: msg => messages.push(msg) });
  await x.runtime.start();
  x.events.emit('exit', 1);
  x.events.emit('exit', 1);
  assert.equal(messages.length, 1);
  assert.match(messages[0], /zakończył/);
  await x.runtime.stop();
});

test('simultaneous start runs one child and stop is idempotent', async (t) => {
  const x = create(t);
  await Promise.all([x.runtime.start(), x.runtime.start()]);
  assert.equal(x.calls.length, 1);
  await Promise.all([x.runtime.stop(), x.runtime.stop()]);
  assert.equal(x.env.JARVIS_LLM_API_KEY, undefined);
});

test('startup timeout kills child instead of adopting it', async (t) => {
  const x = create(t, { fetchImpl: async () => ({ status: 503 }), maxWaitMs: 1400 });
  await assert.rejects(x.runtime.start(), /nie osiągnął gotowości/);
  assert.equal(x.events.killed, true);
});

test('stop during model provisioning cancels setup and prevents any late runtime creation', async () => {
  let finishModel;
  const model = new Promise(resolve => { finishModel = resolve; });
  let cancels = 0;
  let creations = 0;
  const lifecycle = createQwenLifecycle({
    ensureModelImpl: () => model,
    cancelModelImpl: () => { cancels++; },
    runtimeFactory: () => { creations++; throw new Error('Must not create after stop'); },
  });
  const starting = lifecycle.start({ resourcesPath: path.resolve('fake-qwen') });
  const rejected = assert.rejects(starting, /Anulowano/);
  const stopping = lifecycle.stop();
  assert.equal(stopping, lifecycle.stop());
  await stopping;
  finishModel('verified-model');
  await rejected;
  assert.equal(cancels, 1);
  assert.equal(creations, 0);
  await assert.rejects(lifecycle.start(), /zamykanie/);
});

test('packaged lifecycle coalesces provisioning and start and waits for runtime shutdown', async () => {
  let ensures = 0;
  let starts = 0;
  let stops = 0;
  let finishStop;
  const stopped = new Promise(resolve => { finishStop = resolve; });
  const resourcesPath = path.resolve('fake-qwen');
  const onUnexpectedExit = () => {};
  const lifecycle = createQwenLifecycle({
    ensureModelImpl: async options => { ensures++; assert.equal(options.resourcesPath, resourcesPath); },
    cancelModelImpl: () => {},
    runtimeFactory: options => {
      assert.equal(options.resourcesPath, resourcesPath);
      assert.equal(options.onUnexpectedExit, onUnexpectedExit);
      return {
        start: async () => { starts++; return { started: true }; },
        stop: () => { stops++; return stopped; },
      };
    },
  });
  const first = lifecycle.start({ resourcesPath, onUnexpectedExit });
  assert.equal(first, lifecycle.start({ resourcesPath, onUnexpectedExit }));
  assert.deepEqual(await first, { started: true });
  assert.equal(ensures, 1);
  assert.equal(starts, 1);
  let completed = false;
  const stopping = lifecycle.stop();
  const checked = stopping.then(() => { completed = true; });
  await Promise.resolve();
  assert.equal(completed, false);
  assert.equal(stops, 1);
  finishStop();
  await checked;
});

test('failed or cancelled provisioning remains fail closed without creating a runtime', async () => {
  for (const reason of ['Brak modelu Qwen3 8B.', 'Anulowano przygotowanie modelu Qwen.']) {
    let creations = 0;
    const lifecycle = createQwenLifecycle({
      ensureModelImpl: async () => { throw new Error(reason); },
      cancelModelImpl: () => {},
      runtimeFactory: () => { creations++; },
    });
    await assert.rejects(lifecycle.start(), error => error.message === reason);
    assert.equal(creations, 0);
    await lifecycle.stop();
  }
});

test('stop while probing Qwen port prevents a late spawn', async (t) => {
  let finishProbe;
  const probe = new Promise(resolve => { finishProbe = resolve; });
  const x = create(t, { portProbe: () => probe });
  const starting = x.runtime.start();
  const rejected = assert.rejects(starting, /Anulowano/);
  await x.runtime.stop();
  finishProbe(false);
  await rejected;
  assert.equal(x.calls.length, 0);
  assert.equal(x.env.JARVIS_LLM_API_KEY, undefined);
});

for (const event of ['exit', 'close']) {
  test(`Qwen stop waits for owned process ${event} after sending kill`, async (t) => {
    const x = create(t);
    await x.runtime.start();
    let kills = 0;
    x.events.kill = () => { kills++; x.events.killed = true; return true; };
    let stopped = false;
    const stopping = x.runtime.stop();
    assert.equal(stopping, x.runtime.stop());
    const checked = stopping.then(() => { stopped = true; });
    await Promise.resolve();
    assert.equal(stopped, false);
    assert.equal(kills, 1);
    assert.equal(x.env.JARVIS_LLM_API_KEY, undefined);
    x.events.emit(event, 0);
    await checked;
    assert.equal(stopped, true);
  });
}

test('Qwen stop rejects a bounded timeout when kill does not terminate the child', async (t) => {
  const x = create(t, { stopWaitMs: 20 });
  await x.runtime.start();
  x.events.kill = () => { x.events.killed = true; return true; };
  await assert.rejects(x.runtime.stop(), /Nie potwierdzono zatrzymania Qwen/);
  assert.equal(x.env.JARVIS_LLM_API_KEY, undefined);
  x.events.emit('exit', 0);
});

test('Qwen shutdown can be retried through its lifecycle after timeout and a late exit', async (t) => {
  const x = create(t, { stopWaitMs: 20 });
  const lifecycle = createQwenLifecycle({
    ensureModelImpl: async () => {},
    cancelModelImpl: () => {},
    runtimeFactory: () => x.runtime,
  });
  await lifecycle.start({ resourcesPath: x.root });
  x.events.kill = () => { x.events.killed = true; return true; };
  await assert.rejects(lifecycle.stop(), /Nie potwierdzono zatrzymania Qwen/);
  x.events.emit('exit', 0);
  await lifecycle.stop();
  assert.equal(x.env.JARVIS_LLM_API_KEY, undefined);
  await assert.rejects(lifecycle.start(), /zamykanie/);
});
