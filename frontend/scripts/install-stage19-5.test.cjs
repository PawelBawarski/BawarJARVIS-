'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { merge, install, additions } = require('./install-stage19-5.cjs');

test('does not overwrite existing locale values', () => {
  const json = JSON.stringify({ 'lab.checkHistory.title': 'CUSTOM', 'another.existing.key': 'Kept' }, null, 2);
  const after = JSON.parse(merge(json, additions.en));
  assert.equal(after['lab.checkHistory.title'], 'CUSTOM');
  assert.equal(after['another.existing.key'], 'Kept');
});
test('installer is repeatable, keeps locale parity and retains previous data', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-195-'));
  const locale = path.join(dir, 'public', 'i18n');
  fs.mkdirSync(locale, { recursive: true });
  fs.writeFileSync(path.join(locale, 'pl.json'), '{"old":"Poprzedni"}');
  fs.writeFileSync(path.join(locale, 'en.json'), '{"old":"Previous"}');
  try {
    const count = install(dir);
    assert.equal(count, 1 + Object.keys(additions.pl).length);
    const first = fs.readFileSync(path.join(locale, 'pl.json'), 'utf8');
    assert.equal(install(dir), count);
    assert.equal(fs.readFileSync(path.join(locale, 'pl.json'), 'utf8'), first);
    assert.equal(JSON.parse(first).old, 'Poprzedni');
    assert.equal(JSON.parse(fs.readFileSync(path.join(locale, 'en.json'))).old, 'Previous');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
