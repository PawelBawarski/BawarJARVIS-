"use strict";
const test = require('node:test');
const assert = require('node:assert/strict');
const { frontendChildEnv } = require('./web-secret-env.cjs');
test('web search credentials are omitted from frontend and model environment', () => {
  const input = { JARVIS_WEB_SEARCH_API_KEY: 'private', JARVIS_WEB_SEARCH_ENABLED: 'true', PATH: 'test' };
  assert.deepEqual(frontendChildEnv(input), { JARVIS_WEB_SEARCH_ENABLED: 'true', PATH: 'test' });
  assert.equal(input.JARVIS_WEB_SEARCH_API_KEY, 'private');
});
