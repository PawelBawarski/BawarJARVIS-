"use strict";
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { checkOnce, waitForReady } = require('./dev-readiness.cjs');

test('polls until backend status UP; does not accept temporary failures', async () => {
  let attempts = 0;
  const ok = await waitForReady('http://127.0.0.1:8080/api/security/health', {
    jsonStatusUp: true, intervalMs: 1, timeoutMs: 1000,
    check: async (_url, options) => {
      assert.equal(options.jsonStatusUp, true);
      return ++attempts === 3;
    },
  });
  assert.equal(ok, true);
  assert.equal(attempts, 3);
});

test('rejects forbidden network targets and expired readiness', async () => {
  await assert.rejects(waitForReady('https://example.org'), /Niedozwolony/);
  await assert.rejects(waitForReady('http://127.0.0.1:4200/', {
    timeoutMs: 20, intervalMs: 1, check: async () => false,
  }), /Nie osiągnięto/);
});

test('does not mistake a stopped process for readiness', async () => {
  let stopped = true;
  const ready = await waitForReady('http://127.0.0.1:4200/', {
    isStopped: () => stopped, check: async () => { throw Error('should not execute'); },
  });
  assert.equal(ready, false);
});

test('checks HTTP code and JSON status rather than mere open port', async () => {
  let status = 503;
  let body = '{"status":"UP"}';
  const server = http.createServer((_req, res) => { res.writeHead(status); res.end(body); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}/api/security/health`;
  try {
    assert.equal(await checkOnce(url, { jsonStatusUp: true }), false);
    status = 200;
    body = '{"status":"DOWN"}';
    assert.equal(await checkOnce(url, { jsonStatusUp: true }), false);
    body = '{"status":"UP"}';
    assert.equal(await checkOnce(url, { jsonStatusUp: true }), true);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
