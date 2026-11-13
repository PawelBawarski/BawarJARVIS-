'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const installer = path.join(__dirname, 'install-stage21-3.cjs');
function fixture(fn) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-21-3-'));
  try {
    const dir = path.join(temp, 'public/i18n');
    fs.mkdirSync(dir, { recursive: true });
    for (const lang of ['pl', 'en']) fs.writeFileSync(path.join(dir, `${lang}.json`), JSON.stringify({
      'voice.start': 'Record', 'tts.pause': 'Pause', 'tts.resume': 'Resume',
      'tts.read': 'Read', 'custom.keep': 'retained',
    }, null, 2));
    const chat = path.join(temp, 'src/app/features/chat/chat-view');
    const voice = path.join(temp, 'src/app/features/chat/chat-voice');
    fs.mkdirSync(chat, { recursive: true });
    fs.mkdirSync(voice, { recursive: true });
    fs.writeFileSync(path.join(chat, 'chat-view.ts'), `import { ChatSpeech } from '../chat-speech/chat-speech';
  imports: [TranslatePipe, ChatRagSources, ChatVoice, ChatSpeech],
  readonly store = inject(ChatStore);
      this.scrollScheduler.cancel();
  async sendMessage(): Promise<void> {}
  newChat(): void { this.store.newChat(); }
    this.cancelDelete();
    await this.store.removeActiveChat();
`);
    fs.writeFileSync(path.join(chat, 'chat-view.html'), `    <app-chat-voice (textReady)="addVoiceDraft($event)" />`);
    fs.writeFileSync(path.join(voice, 'chat-voice.ts'), `import { effect, inject, output, signal } from '@angular/core';
  readonly textReady = output<string>();`);
    fs.writeFileSync(path.join(voice, 'chat-voice.html'), `<p class="voice-dictation__notice">{{ 'voice.privacy' | translate }}</p>`);
    fn(temp, dir);
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
}
const run = root => spawnSync(process.execPath, [installer, root], { encoding: 'utf8' });
test('21.3 preserves user translations and is idempotent', () => fixture((root, dir) => {
  assert.equal(run(root).status, 0);
  const paths = ['pl', 'en'].map(lang => path.join(dir, `${lang}.json`));
  const before = paths.map(file => fs.readFileSync(file, 'utf8'));
  assert.equal(run(root).status, 0);
  assert.deepEqual(paths.map(file => fs.readFileSync(file, 'utf8')), before);
  for (const file of paths) {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.equal(data['custom.keep'], 'retained');
    assert.equal(typeof data['voice.conversation.enable'], 'string');
    assert.equal(typeof data['voice.conversation.privacy'], 'string');
    assert.ok(fs.existsSync(`${file}.backup-before-stage21-3`));
  }
  const view = fs.readFileSync(path.join(root, 'src/app/features/chat/chat-view/chat-view.ts'), 'utf8');
  assert.match(view, /onVoiceText\(text: string\)/);
  assert.match(view, /ChatVoiceMode/);
  const recorder = fs.readFileSync(path.join(root, 'src/app/features/chat/chat-voice/chat-voice.ts'), 'utf8');
  assert.match(recorder, /autoSend = input\(false\)/);
  assert.ok(fs.existsSync(path.join(root, 'src/app/features/chat/chat-view/chat-view.ts.backup-before-stage21-3')));
}));
test('21.3 fails without 21.2 and leaves both translations untouched', () => fixture((root, dir) => {
  const pl = path.join(dir, 'pl.json');
  const en = path.join(dir, 'en.json');
  fs.writeFileSync(pl, '{}');
  const previous = fs.readFileSync(en, 'utf8');
  assert.notEqual(run(root).status, 0);
  assert.equal(fs.readFileSync(pl, 'utf8'), '{}');
  assert.equal(fs.readFileSync(en, 'utf8'), previous);
}));
