'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const config = path.join(__dirname, '..', 'proxy.conf.cjs');
test('proxy rejects missing session token', () => {
  assert.throws(() => execFileSync(process.execPath, [config], {
    env: { ...process.env, JARVIS_SESSION_TOKEN: '' }, stdio: 'pipe',
  }));
});
test('proxy injects token on /api only', () => {
  const token = 'a'.repeat(64);
  const data = execFileSync(process.execPath, ['-e',
    `const proxy = require(${JSON.stringify(config)}); console.log(JSON.stringify(Object.keys(proxy)));`],
    { env: { ...process.env, JARVIS_SESSION_TOKEN: token }, encoding: 'utf8' });
  assert.deepEqual(JSON.parse(data), ['/api/**']);
});
