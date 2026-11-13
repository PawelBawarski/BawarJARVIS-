'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { install, strings } = require('./install-stage19-3.cjs');

test('19.3 installer adds UI and keys once, preserving older translations', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-19-3-'));
  try {
    const ts = path.join(root, 'src/app/features/ai-lab/agent-isolated-check/agent-isolated-check.ts');
    const html = path.join(root, 'src/app/features/ai-lab/agent-isolated-check/agent-isolated-check.html');
    const pl = path.join(root, 'public/i18n/pl.json');
    const en = path.join(root, 'public/i18n/en.json');
    [ts, html, pl, en].forEach(f => fs.mkdirSync(path.dirname(f), { recursive: true }));
    fs.writeFileSync(ts, "import { TranslatePipe } from '../../../shared/pipes/translate.pipe';\nimports: [TranslatePipe],\n");
    fs.writeFileSync(html, '<section>19.2</section>\n');
    fs.writeFileSync(pl, '{"old":"PL"}\n');
    fs.writeFileSync(en, '{"old":"EN"}\n');
    const count = install(root);
    assert.equal(count, Object.keys(strings.pl).length + 1);
    assert.match(fs.readFileSync(html, 'utf8'), /app-agent-module-check/);
    assert.match(fs.readFileSync(ts, 'utf8'), /imports: \[TranslatePipe, AgentModuleCheck\]/);
    const contents = [ts, html, pl, en].map(f => fs.readFileSync(f, 'utf8'));
    assert.equal(install(root), count);
    assert.deepEqual([ts, html, pl, en].map(f => fs.readFileSync(f, 'utf8')), contents);
    assert.equal(JSON.parse(fs.readFileSync(pl, 'utf8')).old, 'PL');
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('19.3 installer rejects missing 19.2 integration before changing any file', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-bad-19-3-'));
  try {
    for (const [name, value] of Object.entries({
      'src/app/features/ai-lab/agent-isolated-check/agent-isolated-check.ts': 'incompatible',
      'src/app/features/ai-lab/agent-isolated-check/agent-isolated-check.html': '<section></section>',
      'public/i18n/pl.json': '{}', 'public/i18n/en.json': '{}',
    })) {
      const file = path.join(root, name);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, value);
    }
    assert.throws(() => install(root), /Stage 19.2 component shape/);
    assert.equal(fs.readFileSync(path.join(root, 'public/i18n/pl.json'), 'utf8'), '{}');
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
