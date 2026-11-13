'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

test('21.1 install is repeatable and preserves translations and Chat code', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-tts-install-'));
  try {
    const paths = [
      'src/app/features/chat/chat-view/chat-view.ts',
      'src/app/features/chat/chat-view/chat-view.html',
      'scripts/dev-stack.cjs', 'public/i18n/pl.json', 'public/i18n/en.json',
    ];
    const project = path.resolve(__dirname, '..');
    for (const p of paths) {
      const dest = path.join(temp, p);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(path.join(project, p), dest);
    }
    const installed = path.join(__dirname, 'install-stage21-1.cjs');
    const run = () => spawnSync(process.execPath, [installed, temp], { encoding: 'utf8' });
    assert.equal(run().status, 0);
    const first = paths.map(p => fs.readFileSync(path.join(temp, p), 'utf8'));
    assert.equal(run().status, 0);
    assert.deepEqual(paths.map(p => fs.readFileSync(path.join(temp, p), 'utf8')), first);
    assert.ok(first[0].includes('ChatSpeech'));
    assert.ok(first[0].includes('ChatVoice'));
    assert.ok(first[1].includes('app-chat-speech'));
    assert.ok(first[1].includes('app-chat-voice'));
    for (const language of ['pl', 'en']) {
      const json = JSON.parse(fs.readFileSync(path.join(temp, `public/i18n/${language}.json`), 'utf8'));
      assert.equal(typeof json['tts.read'], 'string');
      assert.equal(typeof json['voice.start'], 'string');
    }
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
});
