'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { mergeLocale, integrateComponent, integrateHtml, integratePom, integrateProperties, install, additions } = require('./install-stage20-2.cjs');

test('keeps user translation overrides and appends missing keys', () => {
  const existing = '{"memory.documents.title":"Custom", "original":"Preserve"}';
  const merged = JSON.parse(mergeLocale(existing, additions.en));
  assert.equal(merged['memory.documents.title'], 'Custom');
  assert.equal(merged.original, 'Preserve');
  assert.ok(merged['memory.documents.privacy']);
});

test('integration injects one component and PDF dependency and is repeatable', () => {
  const ts = '@Component({selector:"x",standalone:true,imports:[TranslatePipe]})\nexport class ResearchMemory {}';
  assert.equal(integrateComponent(integrateComponent(ts)), integrateComponent(ts));
  const html = '<section data-testid="memory-local-note"></section>';
  assert.equal(integrateHtml(integrateHtml(html)), integrateHtml(html));
  const pom = '<project><dependencies></dependencies></project>';
  assert.equal(integratePom(integratePom(pom)), integratePom(pom));
  assert.equal(integrateProperties(integrateProperties('spring.application.name=jarvis\n')),
    integrateProperties('spring.application.name=jarvis\n'));
});

test('full installation updates only intended sources and is idempotent', () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-stage20-2-'));
  try {
    const write = (name, contents) => {
      const file = path.join(base, name);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, contents);
      return file;
    };
    const tsPath = write('frontend/src/app/features/ai-lab/research-memory/research-memory.ts',
      '@Component({standalone:true, imports: [TranslatePipe]})\nexport class ResearchMemory {}');
    write('frontend/src/app/features/ai-lab/research-memory/research-memory.html',
      '<section data-testid="memory-local-note"></section>');
    write('backend/pom.xml', '<project><dependencies></dependencies></project>');
    write('backend/src/main/resources/application.properties', 'spring.application.name=jarvis\n');
    write('frontend/public/i18n/pl.json', '{"existing":"Polski"}');
    write('frontend/public/i18n/en.json', '{"existing":"English"}');
    const first = install(base);
    const snapshot = fs.readFileSync(tsPath, 'utf8');
    assert.equal(first, 1 + Object.keys(additions.pl).length);
    assert.equal(install(base), first);
    assert.equal(fs.readFileSync(tsPath, 'utf8'), snapshot);
    assert.ok(fs.readFileSync(path.join(base, 'backend/pom.xml'), 'utf8').includes('<version>3.0.8</version>'));
  } finally { fs.rmSync(base, { recursive: true, force: true }); }
});
