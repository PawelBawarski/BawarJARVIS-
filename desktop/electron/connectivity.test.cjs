const { test } = require('node:test');
const assert = require('node:assert/strict');
const { checkInternet, INTERNET_PROBE_URL } = require('./connectivity.cjs');

test('offline electron reports offline without a network request', async () => {
  let called = false;
  const result = await checkInternet({ isOnline: () => false, fetch: async () => { called = true; } });
  assert.deepEqual(result, { state: 'offline' });
  assert.equal(called, false);
});

test('only probes a fixed HTTPS URL and requires 204', async () => {
  const result = await checkInternet({
    isOnline: () => true,
    fetch: async (url, options) => {
      assert.equal(url, INTERNET_PROBE_URL);
      assert.equal(url.startsWith('https://'), true);
      assert.equal(options.redirect, 'error');
      return { status: 204 };
    },
  });
  assert.deepEqual(result, { state: 'online' });
});

test('returns unverified instead of claiming offline when probe is blocked', async () => {
  assert.deepEqual(await checkInternet({ isOnline: () => true, fetch: async () => { throw Error('blocked'); } }),
    { state: 'unverified' });
});
