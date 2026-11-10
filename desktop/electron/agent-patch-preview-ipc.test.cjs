'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { routeAgent, performAgentRequest } = require('./agent-proposal-ipc.cjs');
const source = { relativePath: 'frontend/src/app/chat.ts', content: 'export const x = 1;' };

test('patch preview accepts one reviewed snippet through fixed endpoint only', () => {
  const result = routeAgent({ operation: 'patch-preview', task: 'Zmień x', source });
  assert.deepEqual(result, {
    method: 'POST', path: '/api/agent/patch-preview',
    body: { task: 'Zmień x', source },
  });
});

test('patch preview rejects unsafe paths and oversized excerpts', () => {
  for (const relativePath of ['../secret.env', '/etc/passwd', 'frontend/.env', 'frontend/src/token.ts', 'frontend\\src\\a.ts']) {
    assert.throws(() => routeAgent({ operation: 'patch-preview', task: 'test', source: { relativePath, content: 'x' } }));
  }
  assert.throws(() => routeAgent({ operation: 'patch-preview', task: 'x', source: { ...source, content: 'x'.repeat(3601) } }));
});

test('patch preview rejects invalid requests before network access', () => {
  assert.throws(() => routeAgent({ operation: 'patch-preview', task: '', source }));
  assert.throws(() => routeAgent({ operation: 'patch-preview', task: 'x'.repeat(1201), source }));
  assert.throws(() => routeAgent({ operation: 'patch-preview', task: 'ok', source: { ...source, unexpected: true } }));
  assert.throws(() => routeAgent({ operation: 'apply-patch', task: 'ok', source }));
});

test('no valid private session token means no outbound request', async () => {
  let called = false;
  const result = await performAgentRequest({ operation: 'patch-preview', task: 'Zmień', source }, 'INVALID', async () => {
    called = true;
    throw new Error('not allowed');
  });
  assert.equal(result.ok, false);
  assert.equal(called, false);
});

test('private token is only placed in privileged request headers', async () => {
  const token = 'a'.repeat(64);
  let checked = false;
  const response = await performAgentRequest({ operation: 'patch-preview', task: 'Zmień', source }, token, async (url, options) => {
    checked = true;
    assert.equal(url, 'http://127.0.0.1:8080/api/agent/patch-preview');
    assert.equal(options.headers['X-Jarvis-Session'], token);
    assert.equal(JSON.parse(options.body).source.content, source.content);
    assert.ok(!options.body.includes(token));
    return { ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => ({ diff: '-a\n+b' }) };
  });
  assert.equal(checked, true);
  assert.equal(response.ok, true);
});
