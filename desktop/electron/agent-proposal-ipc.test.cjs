'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { routeAgent, performAgentRequest, registerAgentIpc } = require('./agent-proposal-ipc.cjs');
const ID = '8ef71522-27d0-4f9b-9bb3-d0245b9bf440';
const TOKEN = 'f'.repeat(64);

test('only four fixed routes are supported', () => {
  assert.deepEqual(routeAgent({ operation: 'list' }), { method: 'GET', path: '/api/agent/proposals' });
  assert.deepEqual(routeAgent({ operation: 'decide', id: ID, decision: 'APPROVED' }), {
    method: 'POST', path: `/api/agent/proposals/${ID}/decision`, body: { decision: 'APPROVED' },
  });
  assert.throws(() => routeAgent({ operation: 'execute', command: 'rm -rf .' }), /Unsupported/);
  assert.throws(() => routeAgent({ operation: 'decide', id: '../etc', decision: 'APPROVED' }), /Invalid proposal ID/);
});

test('rejects blank and oversized prompts before sending', () => {
  assert.throws(() => routeAgent({ operation: 'generate', task: '' }), /Invalid task/);
  assert.throws(() => routeAgent({ operation: 'generate', task: 'a'.repeat(1201) }), /Invalid task/);
  assert.throws(() => routeAgent({ operation: 'revise', id: ID, feedback: '' }), /Invalid revision/);
  assert.throws(() => routeAgent({ operation: 'decide', id: ID, decision: 'RUN' }), /Invalid decision/);
});

test('never calls backend without a private session', async () => {
  let called = false;
  const result = await performAgentRequest({ operation: 'list' }, '', () => { called = true; });
  assert.equal(result.status, 401);
  assert.equal(called, false);
});

test('token appears only in privileged Electron HTTP header', async () => {
  let seen;
  const result = await performAgentRequest({ operation: 'generate', task: 'Dodaj funkcję' }, TOKEN, async (url, init) => {
    seen = { url, init };
    return { ok: true, status: 201, headers: { get: () => 'application/json' }, json: async () => ({ status: 'PENDING' }) };
  });
  assert.equal(result.ok, true);
  assert.equal(seen.url, 'http://127.0.0.1:8080/api/agent/proposals');
  assert.equal(seen.init.headers['X-Jarvis-Session'], TOKEN);
  assert.deepEqual(JSON.parse(seen.init.body), { task: 'Dodaj funkcję' });
  assert.equal(seen.init.redirect, 'error');
});

test('rejected or missing backend returns structured error', async () => {
  const response = await performAgentRequest({ operation: 'list' }, TOKEN, async () => {
    throw new Error('ECONNREFUSED');
  });
  assert.equal(response.ok, false);
  assert.equal(response.error, 'AGENT_BACKEND_UNAVAILABLE');
});

test('an untrusted IPC renderer cannot reach backend', async () => {
  let handler;
  registerAgentIpc({ handle: (_name, fn) => { handler = fn; } }, () => false, () => TOKEN);
  await assert.rejects(handler({}, { operation: 'list' }), /Untrusted IPC sender/);
});

test('approved snippets are forwarded only to a fixed local endpoint', async () => {
  const input = { operation: 'generate', task: 'Review the code', sources: [
    { relativePath: 'frontend/src/app/app.ts', content: 'export const answer = 42;' },
  ] };
  const route = routeAgent(input);
  assert.equal(route.method, 'POST');
  assert.equal(route.path, '/api/agent/proposals');
  assert.deepEqual(route.body.sources, input.sources);
});

test('rejects traversal, secrets, extra fields and excessive source context', () => {
  for (const relativePath of ['../.env', 'frontend/../../secret.ts', 'C:/secret.ts',
      'frontend\\code.ts', 'frontend/node_modules/secret.ts', '.env']) {
    assert.throws(() => routeAgent({ operation: 'generate', task: 'Review',
      sources: [{ relativePath, content: 'abc' }] }), /Invalid source/);
  }
  assert.throws(() => routeAgent({ operation: 'generate', task: 'Review', sources: [
    { relativePath: 'README.md', content: 'a'.repeat(3601) },
  ] }), /Invalid source/);
  assert.throws(() => routeAgent({ operation: 'generate', task: 'Review', sources: [
    { relativePath: 'README.md', content: 'ok', url: 'https://example.com' },
  ] }), /Invalid source/);
  assert.throws(() => routeAgent({ operation: 'generate', task: 'Review', sources: [
    { relativePath: 'README.md', content: 'ok' }, { relativePath: 'README.md', content: 'ok' },
  ] }), /Invalid source/);
});
