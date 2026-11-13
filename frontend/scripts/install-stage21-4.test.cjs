'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const actual = path.resolve(__dirname, '..');
const installer = path.join(__dirname, 'install-stage21-4.cjs');
const paths = [
  'src/app/core/services/local-tts-player.ts',
  'src/app/core/services/voice-conversation.ts',
  'src/app/features/chat/chat-voice-mode/chat-voice-mode.ts',
  'src/app/features/chat/chat-voice-mode/chat-voice-mode.html',
  'public/i18n/pl.json', 'public/i18n/en.json',
];
function withFixture(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-214-'));
  try {
    for (const relative of paths) {
      const dest = path.join(dir, relative);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(path.join(actual, relative), dest);
    }
    return fn(dir);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
const run = (dir, extra = []) => spawnSync(process.execPath, [installer, dir, ...extra], { encoding: 'utf8' });

test('21.4 installer only adds voice components/translation keys and is idempotent', () => withFixture(dir => {
  const original = Object.fromEntries(paths.map(p => [p, fs.readFileSync(path.join(dir, p), 'utf8')]));
  const checked = run(dir, ['--check']);
  assert.equal(checked.status, 0, checked.stderr);
  for (const p of paths) assert.equal(fs.readFileSync(path.join(dir, p), 'utf8'), original[p]);
  const first = run(dir);
  assert.equal(first.status, 0, first.stderr);
  for (const language of ['pl','en']) {
    const dict = JSON.parse(fs.readFileSync(path.join(dir, `public/i18n/${language}.json`)));
    assert.ok(dict['voice.conversation.enable']);
    assert.ok(dict['voice.health.refresh']);
    assert.ok(dict['tts.read']);
  }
  assert.match(fs.readFileSync(path.join(dir, paths[0]), 'utf8'), /checkAvailability\(force = false\)/);
  assert.match(fs.readFileSync(path.join(dir, paths[1]), 'utf8'), /checkAvailability\(true\)/);
  assert.match(fs.readFileSync(path.join(dir, paths[2]), 'utf8'), /VoiceDiagnostics/);
  assert.match(fs.readFileSync(path.join(dir, paths[3]), 'utf8'), /<app-voice-diagnostics/);
  const installed = Object.fromEntries(paths.map(p => [p, fs.readFileSync(path.join(dir, p), 'utf8')]));
  const second = run(dir);
  assert.equal(second.status, 0, second.stderr);
  for (const p of paths) {
    assert.equal(fs.readFileSync(path.join(dir, p), 'utf8'), installed[p]);
    if (installed[p] !== original[p]) {
      assert.equal(fs.readFileSync(path.join(dir, p + '.backup-before-stage21-4'), 'utf8'), original[p]);
    }
  }
}));

test('21.4 preflight fails safely when an earlier stage is missing', () => withFixture(dir => {
  const file = path.join(dir, 'src/app/core/services/local-tts-player.ts');
  fs.writeFileSync(file, 'export class MissingPreviousStage {}');
  const oldPl = fs.readFileSync(path.join(dir, 'public/i18n/pl.json'), 'utf8');
  const result = run(dir);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /STAGE_21_4_EXPECTED/);
  assert.equal(fs.readFileSync(path.join(dir, 'public/i18n/pl.json'), 'utf8'), oldPl);
}));

test('21.4 does not replace custom translations or add duplicates', () => withFixture(dir => {
  const file = path.join(dir, 'public/i18n/pl.json');
  const dict = JSON.parse(fs.readFileSync(file, 'utf8'));
  dict['voice.health.refresh'] = 'Mój tekst sprawdzania';
  fs.writeFileSync(file, JSON.stringify(dict, null, 2));
  assert.equal(run(dir).status, 0);
  const current = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(current['voice.health.refresh'], 'Mój tekst sprawdzania');
  assert.equal(run(dir).status, 0);
}));
