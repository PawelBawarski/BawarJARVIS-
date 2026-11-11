'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createRuntimeLifecycle } = require('./runtime-lifecycle.cjs');

function fixture(overrides = {}) {
  const calls = [];
  const services = {};
  for (const name of ['startDatabase', 'startQwen', 'startBackend',
    'stopBackend', 'stopQwen', 'stopDatabase']) {
    services[name] = async () => { calls.push(name); };
  }
  return { calls, lifecycle: createRuntimeLifecycle({ ...services, ...overrides }) };
}

test('starts dependencies once and stops Java before Qwen and PostgreSQL', async () => {
  const { calls, lifecycle } = fixture();
  await Promise.all([lifecycle.start({}), lifecycle.start({})]);
  await Promise.all([lifecycle.stop(), lifecycle.stop()]);
  assert.deepEqual(calls, ['startDatabase', 'startQwen', 'startBackend',
    'stopBackend', 'stopQwen', 'stopDatabase']);
});

test('PostgreSQL shutdown waits for confirmed Java exit', async () => {
  let releaseJava;
  const javaExited = new Promise(resolve => { releaseJava = resolve; });
  const { calls, lifecycle } = fixture({ stopBackend: () => javaExited });
  await lifecycle.start({});
  const stopping = lifecycle.stop();
  await Promise.resolve();
  assert.equal(calls.includes('stopDatabase'), false);
  releaseJava();
  await stopping;
  assert.equal(calls.includes('stopDatabase'), true);
});

test('unconfirmed Java shutdown preserves the database and reports failure', async () => {
  const { calls, lifecycle } = fixture({ stopBackend: async () => { throw Error('Java still running'); } });
  await lifecycle.start({});
  await assert.rejects(lifecycle.stop(), /Java still running/);
  assert.equal(calls.includes('stopDatabase'), false);
});

test('quit during bootstrap cancels it and never starts later dependencies', async () => {
  let releaseBootstrap;
  const bootstrap = new Promise(resolve => { releaseBootstrap = resolve; });
  const { calls, lifecycle } = fixture({
    startDatabase: () => bootstrap,
    stopDatabase: async () => { releaseBootstrap(); },
  });
  const starting = assert.rejects(lifecycle.start({}), /Anulowano/);
  await lifecycle.stop();
  await starting;
  assert.equal(calls.includes('startQwen'), false);
  assert.equal(calls.includes('startBackend'), false);
  await assert.rejects(lifecycle.start({}), /zamykanie/);
});

test('startup failure does not start Java and can still close dependencies', async () => {
  const { calls, lifecycle } = fixture({ startQwen: async () => { throw Error('Missing model'); } });
  await assert.rejects(lifecycle.start({}), /Missing model/);
  await lifecycle.stop();
  assert.equal(calls.includes('startBackend'), false);
  assert.equal(calls.includes('stopDatabase'), true);
});

test('pending native model selection cannot block quit or start Java afterwards', async () => {
  let releaseModel;
  let announceModel;
  const choosing = new Promise(resolve => { announceModel = resolve; });
  const model = new Promise(resolve => { releaseModel = resolve; });
  const { calls, lifecycle } = fixture({ startQwen: () => { announceModel(); return model; } });
  const starting = assert.rejects(lifecycle.start({}), /Anulowano/);
  await choosing;
  await lifecycle.stop();
  assert.equal(calls.includes('stopDatabase'), true);
  releaseModel();
  await starting;
  assert.equal(calls.includes('startBackend'), false);
});
