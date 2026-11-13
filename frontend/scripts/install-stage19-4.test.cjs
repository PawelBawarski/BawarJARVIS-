'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { updateTs, updateHtml, mergeLocale, translations, install } = require('./install-stage19-4.cjs');

test('19.4 safely integrates the existing 19.3 panel only once', () => {
  const ts = "import { AgentModuleCheck } from '../agent-module-check/agent-module-check';\nimports: [TranslatePipe, AgentModuleCheck],";
  const html = '<app-agent-module-check [preview]="preview()" [enabled]="config()?.enabled === true" />';
  assert.equal(updateTs(updateTs(ts)), updateTs(ts));
  assert.equal(updateHtml(updateHtml(html)), updateHtml(html));
});
test('19.4 preserves custom translations and keys', () => {
  const pl = '{"custom.key":"custom"}';
  const combined = mergeLocale(pl, translations.pl);
  assert.equal(JSON.parse(combined)['custom.key'], 'custom');
  assert.deepEqual(Object.keys(translations.pl).sort(), Object.keys(translations.en).sort());
  assert.equal(mergeLocale(combined, translations.pl), combined);
});
test('19.4 creates backups and is idempotent', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-install194-'));
  try {
    const file = relative => {
      const target = path.join(dir, relative);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      return target;
    };
    const ts = file('src/app/features/ai-lab/agent-isolated-check/agent-isolated-check.ts');
    const html = file('src/app/features/ai-lab/agent-isolated-check/agent-isolated-check.html');
    fs.writeFileSync(ts, "import { AgentModuleCheck } from '../agent-module-check/agent-module-check';\nimports: [TranslatePipe, AgentModuleCheck],");
    fs.writeFileSync(html, '<app-agent-module-check [preview]="preview()" [enabled]="config()?.enabled === true" />');
    fs.writeFileSync(file('public/i18n/pl.json'), '{"previous":"poprzedni"}');
    fs.writeFileSync(file('public/i18n/en.json'), '{"previous":"previous"}');
    const first = install(dir);
    const second = install(dir);
    assert.equal(first, second);
    assert.equal(first, Object.keys(translations.pl).length + 1);
    assert.ok(fs.existsSync(ts + '.backup-before-stage-19-4'));
    assert.equal(fs.readFileSync(ts, 'utf8').match(/import \{ AgentProjectCheck \}/g)?.length, 1);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
