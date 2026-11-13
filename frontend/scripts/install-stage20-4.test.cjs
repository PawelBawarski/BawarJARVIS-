'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { patchChatTs, patchChatHtml, mergeLocale, locales, install } = require('./install-stage20-4.cjs');

test('Angular TS and template integration is idempotent', () => {
  const ts = `import { TranslatePipe } from 't';\n@Component({ imports: [TranslatePipe] }) export class ChatView {}`;
  const html = '<main><p>Chat</p></main>\n<footer>Composer</footer>';
  assert.equal(patchChatTs(patchChatTs(ts)), patchChatTs(ts));
  assert.equal(patchChatHtml(patchChatHtml(html)), patchChatHtml(html));
  assert.match(patchChatTs(ts), /ChatRagSources/);
  assert.match(patchChatHtml(html), /app-chat-rag-sources/);
  assert.throws(() => patchChatHtml('<main>no footer</main>'), /CHAT_MAIN_FOOTER_NOT_FOUND/);
});

test('PL/EN additions are identical and preserve existing keys', () => {
  assert.deepEqual(Object.keys(locales.pl).sort(), Object.keys(locales.en).sort());
  const before = '{\n  "existing.key": "Saved"\n}\n';
  const result = mergeLocale(before, locales.en);
  assert.equal(mergeLocale(result, locales.en), result);
  assert.equal(JSON.parse(result)['existing.key'], 'Saved');
});

test('installer is safe to repeat and creates backups for existing project files', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-20-4-'));
  try {
    const inputs = {
      'frontend/src/app/features/chat/chat-view/chat-view.ts': `import { TranslatePipe } from 'x';\n@Component({ imports: [TranslatePipe] }) export class ChatView {}`,
      'frontend/src/app/features/chat/chat-view/chat-view.html': '<main>Messages</main>\n<footer>Compose</footer>',
      'frontend/public/i18n/pl.json': '{"existing.key":"Pozostaje"}',
      'frontend/public/i18n/en.json': '{"existing.key":"Preserved"}'
    };
    for (const [name, contents] of Object.entries(inputs)) {
      const filename = path.join(root, name);
      fs.mkdirSync(path.dirname(filename), { recursive: true });
      fs.writeFileSync(filename, contents);
    }
    assert.equal(install(root), 10);
    assert.equal(install(root), 10);
    for (const name of Object.keys(inputs)) {
      assert.ok(fs.existsSync(path.join(root, name + '.backup-before-stage20-4')));
    }
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
