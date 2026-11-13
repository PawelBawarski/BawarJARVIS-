'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

test('21.0 installer adds Chat voice, PL/EN and env loader once without deleting other code', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis21-install-'));
  const copy = relative => {
    const to = path.join(root, relative);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(path.resolve(__dirname, '..', relative), to);
  };
  const paths = [
    'src/app/features/chat/chat-view/chat-view.ts',
    'src/app/features/chat/chat-view/chat-view.html',
    'scripts/dev-stack.cjs', 'public/i18n/pl.json', 'public/i18n/en.json',
  ];
  for (const file of paths) copy(file);
  // Stage 19.2 adds TESTS_ENABLED to the same loader regex; retain it.
  const stack = path.join(root, 'scripts/dev-stack.cjs');
  fs.writeFileSync(stack, fs.readFileSync(stack, 'utf8').replace(
    'AGENT_(?:WORKSPACE_ROOT|FILE_WRITES_ENABLED)',
    'AGENT_(?:WORKSPACE_ROOT|FILE_WRITES_ENABLED|TESTS_ENABLED)'), 'utf8');
  try {
    const install = () => execFileSync(process.execPath, [path.join(__dirname, 'install-stage21-0.cjs'), root]);
    install();
    const ts = fs.readFileSync(path.join(root, paths[0]), 'utf8');
    assert.match(ts, /addVoiceDraft\(text: string\)/);
    assert.match(ts, /imports: \[[^\]]*ChatVoice/);
    assert.match(fs.readFileSync(path.join(root, paths[1]), 'utf8'), /<app-chat-voice/);
    assert.match(fs.readFileSync(path.join(root, paths[2]), 'utf8'), /WHISPER_MODEL_PATH/);
    for (const lang of ['pl','en']) {
      const trans = JSON.parse(fs.readFileSync(path.join(root, `public/i18n/${lang}.json`), 'utf8'));
      assert.ok(trans['voice.privacy']);
      assert.ok(trans['chat.title']);
    }
    const before = paths.map(x => fs.readFileSync(path.join(root,x),'utf8'));
    install();
    assert.deepEqual(paths.map(x => fs.readFileSync(path.join(root,x),'utf8')), before);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
