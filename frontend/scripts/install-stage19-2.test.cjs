'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { merge, install, texts } = require('./install-stage19-2.cjs');

test('19.2 preserves existing keys and is idempotent', () => {
  const initial = '{\n  "existing": "keep me"\n}\n';
  const once = merge(initial, texts.pl);
  assert.equal(JSON.parse(once).existing, 'keep me');
  assert.equal(merge(once, texts.pl), once);
  assert.equal(Object.keys(JSON.parse(once)).length, 15);
});

test('19.2 refuses to overwrite a conflicting translation', () => {
  const bad = JSON.stringify({ 'lab.isolated.title': 'User custom title' });
  assert.throws(() => merge(bad, texts.pl), /Conflicting translation/);
});

test('19.2 does not modify either file when PL/EN key sets differ', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-i18n-test-'));
  try {
    const pl = path.join(temp, 'pl.json'); const en = path.join(temp, 'en.json');
    fs.writeFileSync(pl, '{"a":"a"}\n'); fs.writeFileSync(en, '{"b":"b"}\n');
    assert.throws(() => install({ pl, en }), /key sets differ/);
    assert.equal(fs.readFileSync(pl, 'utf8'), '{"a":"a"}\n');
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
});
