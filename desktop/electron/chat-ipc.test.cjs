'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { routeRequest, performChatRequest, registerChatIpc } = require('./chat-ipc.cjs');
const TOKEN = 'c'.repeat(64);
const ID = '8ef71522-27d0-4f9b-9bb3-d0245b9bf440';

test('only six exact operations map to fixed localhost endpoints', () => {
  assert.deepEqual(routeRequest({ operation: 'list' }), { method: 'GET', path: '/api/chats' });
  assert.deepEqual(routeRequest({ operation: 'delete', id: ID }), { method: 'DELETE', path: `/api/chats/${ID}` });
  assert.throws(() => routeRequest({ operation: 'fetch', url: 'https://evil.test' }), /Unsupported/);
  assert.throws(() => routeRequest({ operation: 'get', id: '../security' }), /Invalid conversation/);
});
test('no token -> no fetch', async () => {
  let called = false;
  const response = await performChatRequest({ operation: 'list' }, '', () => { called = true; });
  assert.equal(response.status, 401);
  assert.equal(called, false);
});
test('token travels only in Electron privileged header to localhost', async () => {
  let observed;
  const response = await performChatRequest({ operation: 'send', id: ID, content: 'Cześć' }, TOKEN,
    async (url, init) => {
      observed = { url, init };
      return { ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => ({ userMessage: {}, assistantMessage: {} }) };
    });
  assert.equal(response.ok, true);
  assert.equal(observed.url, `http://127.0.0.1:8080/api/chats/${ID}/messages`);
  assert.equal(observed.init.headers['X-Jarvis-Session'], TOKEN);
  assert.equal(JSON.parse(observed.init.body).content, 'Cześć');
});
test('backend 401 becomes structured error', async () => {
  const result = await performChatRequest({ operation: 'list' }, TOKEN,
    async () => ({ ok: false, status: 401, headers: { get: () => 'application/json' }, json: async () => ({ code: 'UNAUTHORIZED' }) }));
  assert.deepEqual(result, { ok: false, status: 401, error: 'UNAUTHORIZED' });
});
test('unreachable backend does not crash renderer', async () => {
  const result = await performChatRequest({ operation: 'list' }, TOKEN, async () => { throw new Error('ECONNREFUSED'); });
  assert.equal(result.status, 0);
  assert.equal(result.error, 'BACKEND_UNAVAILABLE');
});
test('forbidden IPC sender never reaches backend', async () => {
  let handler;
  registerChatIpc({ handle: (_channel, fn) => { handler = fn; } }, () => false, () => TOKEN);
  await assert.rejects(() => handler({}, { operation: 'list' }), /Untrusted IPC sender/);
});
