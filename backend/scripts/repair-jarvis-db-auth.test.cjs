'use strict';
/** Install as: BawarJARVIS-/backend/scripts/repair-jarvis-db-auth.test.cjs */
const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { readDevSettings, sqlPasswordLiteral } = require('./repair-jarvis-db-auth.cjs');

test('sqlPasswordLiteral escapes apostrophes without changing the secret', () => {
  assert.equal(sqlPasswordLiteral("ab'c"), "'ab''c'");
  assert.throws(() => sqlPasswordLiteral('bad\nvalue'), /Niepoprawna/);
});

test('reads only expected local development target', t => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-db-auth-'));
  t.after(() => fs.rmSync(folder, { recursive: true, force: true }));
  const file = path.join(folder, '.env.jarvis');
  fs.writeFileSync(file,
    'JARVIS_DB_HOST=127.0.0.1\nJARVIS_DB_PORT=5433\n' +
    'JARVIS_DB_NAME=jarvis_db\nJARVIS_DB_USER=jarvis\n' +
    'JARVIS_DB_PASSWORD="secret example"\n');
  assert.equal(readDevSettings(file, {}).JARVIS_DB_PASSWORD, 'secret example');
  assert.throws(() => readDevSettings(file, {JARVIS_DB_PASSWORD:'other'}), /nadpisane/);
});

test('refuses unexpected port', t => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-db-auth-'));
  t.after(() => fs.rmSync(folder, { recursive: true, force: true }));
  const file = path.join(folder, '.env.jarvis');
  fs.writeFileSync(file,
    'JARVIS_DB_HOST=127.0.0.1\nJARVIS_DB_PORT=55432\n' +
    'JARVIS_DB_NAME=jarvis_db\nJARVIS_DB_USER=jarvis\n' +
    'JARVIS_DB_PASSWORD=secret\n');
  assert.throws(() => readDevSettings(file, {}), /Nieoczekiwany cel/);
});
