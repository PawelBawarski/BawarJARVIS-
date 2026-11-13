'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const installer = path.join(__dirname, 'install-stage21-2.cjs');
function fixture(fn) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-21-2-'));
  try {
    const dir = path.join(temp, 'public/i18n');
    fs.mkdirSync(dir, { recursive: true });
    for (const language of ['pl', 'en']) {
      fs.writeFileSync(path.join(dir, `${language}.json`), JSON.stringify({
        'tts.read': 'Read', 'tts.stop': 'Stop', 'tts.playPrepared': 'Play',
        'custom.keep': 'preserved',
      }, null, 2));
    }
    fn(temp, dir);
  } finally { fs.rmSync(temp, { force: true, recursive: true }); }
}
const run = dir => spawnSync(process.execPath, [installer, dir], { encoding: 'utf8' });
test('21.2 adds PL/EN controls, preserves values and is repeatable', () => fixture((temp, dir) => {
  assert.equal(run(temp).status, 0);
  const files = ['pl', 'en'].map(language => path.join(dir, `${language}.json`));
  const before = files.map(f => fs.readFileSync(f, 'utf8'));
  assert.equal(run(temp).status, 0);
  assert.deepEqual(files.map(f => fs.readFileSync(f, 'utf8')), before);
  for (const f of files) {
    const json = JSON.parse(fs.readFileSync(f, 'utf8'));
    assert.equal(json['custom.keep'], 'preserved');
    for (const key of ['tts.pause', 'tts.resume', 'tts.paused', 'tts.part', 'tts.tooLong21_2']) {
      assert.equal(typeof json[key], 'string');
    }
    assert.ok(fs.existsSync(`${f}.backup-before-stage21-2`));
  }
}));
test('21.2 rejects missing prior setup without changing any dictionaries', () => fixture((temp, dir) => {
  const pl = path.join(dir, 'pl.json');
  fs.writeFileSync(pl, '{}');
  const en = path.join(dir, 'en.json');
  const enBefore = fs.readFileSync(en, 'utf8');
  assert.notEqual(run(temp).status, 0);
  assert.equal(fs.readFileSync(pl, 'utf8'), '{}');
  assert.equal(fs.readFileSync(en, 'utf8'), enBefore);
}));
