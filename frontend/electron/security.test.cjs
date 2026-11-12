'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { isTrustedDevUrl } = require('./security.cjs');
test('Electron developer shell accepts only the Angular loopback origin', () => {
  assert.equal(isTrustedDevUrl('http://127.0.0.1:4200/'), true);
  assert.equal(isTrustedDevUrl('http://127.0.0.1:4200/ai-lab'), true);
  for (const value of [
    'https://127.0.0.1:4200/', 'http://localhost:4200/',
    'http://127.0.0.1:4201/', 'http://evil.test/',
    'file:///c:/windows/system.ini', 'javascript:alert(1)',
    'http://evil.test@127.0.0.1:4200/', 'not a url',
  ]) assert.equal(isTrustedDevUrl(value), false, value);
});
