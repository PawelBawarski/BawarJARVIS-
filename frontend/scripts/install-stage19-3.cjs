#!/usr/bin/env node
'use strict';
/** Integrates Stage 19.3 without replacing any existing Stage 19.2 source or translations. */
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');

const strings = {
  pl: {
    'lab.module.title': 'Test powiązanych plików (Docker)',
    'lab.module.description': 'Dołącz maksymalnie 8 plików z tego samego katalogu co proponowany kod. Przeglądarka przekaże tylko wybrane pliki. Bez dostępu do całego projektu.',
    'lab.module.safety': 'Kontrola uruchamia się wyłącznie po Twoim kliknięciu. Nie zapisuje plików i nie zatwierdza zmian.',
    'lab.module.disabled': 'Runner Docker jest wyłączony. Najpierw włącz kontrole 19.2 w konfiguracji Spring Boot.',
    'lab.module.unsupported': 'Ten typ pliku nie obsługuje jeszcze testów modułu.',
    'lab.module.select': 'Dodatkowe pliki modułu (opcjonalne)',
    'lab.module.sibling': 'Wybierz pliki z tego samego katalogu. JS: można dodać plik *.test.js / *.test.cjs. Java: dołącz klasy pomocnicze. TS: tylko kontrola składni, bez Angulara i typów.',
    'lab.module.count': 'Pliki w zestawie',
    'lab.module.testFile': 'Plik testowy do uruchomienia',
    'lab.module.syntaxOnly': 'Tylko składnia',
    'lab.module.run': 'Sprawdź wybrane pliki w Dockerze',
    'lab.module.running': 'Trwa kontrola przygotowanej kopii plików…',
    'lab.module.mode': 'Zakres sprawdzania',
    'lab.module.snapshot': 'zestaw plików',
    'lab.module.proposal': 'propozycja kodu',
    'lab.module.error': 'Nie udało się sprawdzić wybranych plików.',
    'lab.module.disclaimer': 'PASS dotyczy tylko wskazanych plików. Nie jest pełnym ng test / mvn test, nie weryfikuje bezpieczeństwa kodu i nie jest zgodą na zapis.',
  },
  en: {
    'lab.module.title': 'Related-files check (Docker)',
    'lab.module.description': 'Add up to 8 files from the same folder as the proposed source. The browser sends only the files you explicitly select, never the whole project.',
    'lab.module.safety': 'The check runs only after you click. It neither writes to disk nor approves changes.',
    'lab.module.disabled': 'The Docker runner is disabled. Enable Stage 19.2 checks in Spring Boot first.',
    'lab.module.unsupported': 'Module checks do not support this file type yet.',
    'lab.module.select': 'Additional module files (optional)',
    'lab.module.sibling': 'Select files from the same folder. JS: add a *.test.js / *.test.cjs file. Java: add helper classes. TS: syntax only, without Angular or type checking.',
    'lab.module.count': 'Files in the snapshot',
    'lab.module.testFile': 'Test file to execute',
    'lab.module.syntaxOnly': 'Syntax only',
    'lab.module.run': 'Check selected files in Docker',
    'lab.module.running': 'Checking the isolated file snapshot…',
    'lab.module.mode': 'Check type',
    'lab.module.snapshot': 'file snapshot',
    'lab.module.proposal': 'code proposal',
    'lab.module.error': 'Could not check the selected files.',
    'lab.module.disclaimer': 'PASS covers only the selected files. This is not a full ng test / mvn test, a security assessment, or permission to save changes.',
  },
};

function updatedModuleTs(content) {
  if (content.includes("import { AgentModuleCheck }")) return content;
  const anchor = "import { TranslatePipe } from '../../../shared/pipes/translate.pipe';";
  if (!content.includes(anchor) || !content.includes('imports: [TranslatePipe],'))
    throw new Error('Stage 19.2 component shape differs; integration aborted');
  return content.replace(anchor, anchor + "\nimport { AgentModuleCheck } from '../agent-module-check/agent-module-check';")
    .replace('imports: [TranslatePipe],', 'imports: [TranslatePipe, AgentModuleCheck],');
}
function updatedModuleHtml(content) {
  if (content.includes('<app-agent-module-check')) return content;
  if (!content.includes('</section>')) throw new Error('Missing Stage 19.2 panel');
  return content.trimEnd() + '\n<app-agent-module-check [preview]="preview()" [enabled]="config()?.enabled === true" />\n';
}
function mergeLocale(raw, extra) {
  const obj = JSON.parse(raw);
  const missing = Object.entries(extra).filter(([key]) => !Object.hasOwn(obj, key));
  if (!missing.length) return raw;
  const eol = raw.includes('\r\n') ? '\r\n' : '\n';
  const close = raw.lastIndexOf('}');
  if (close < 0) throw new Error('Invalid translations');
  const before = raw.slice(0, close).trimEnd();
  const comma = before.endsWith('{') ? '' : ',';
  const added = missing.map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(',' + eol);
  const merged = before + comma + eol + added + eol + raw.slice(close);
  JSON.parse(merged);
  return merged;
}
function install(target = root) {
  const targets = {
    ts: path.join(target, 'src/app/features/ai-lab/agent-isolated-check/agent-isolated-check.ts'),
    html: path.join(target, 'src/app/features/ai-lab/agent-isolated-check/agent-isolated-check.html'),
    pl: path.join(target, 'public/i18n/pl.json'),
    en: path.join(target, 'public/i18n/en.json'),
  };
  const old = Object.fromEntries(Object.entries(targets).map(([key, file]) => [key, fs.readFileSync(file, 'utf8')]));
  const next = {
    ts: updatedModuleTs(old.ts),
    html: updatedModuleHtml(old.html),
    pl: mergeLocale(old.pl, strings.pl),
    en: mergeLocale(old.en, strings.en),
  };
  const pl = Object.keys(JSON.parse(next.pl)).sort();
  const en = Object.keys(JSON.parse(next.en)).sort();
  if (JSON.stringify(pl) !== JSON.stringify(en)) throw new Error('PL/EN translation keys differ');
  for (const [key, file] of Object.entries(targets)) {
    if (old[key] === next[key]) continue;
    const backup = file + '.backup-before-stage-19-3';
    if (!fs.existsSync(backup)) fs.copyFileSync(file, backup);
    fs.writeFileSync(file, next[key], 'utf8');
  }
  return pl.length;
}
if (require.main === module) {
  try { console.log(`STAGE_19_3_OK: integration and ${install()} PL/EN keys`); }
  catch (e) { console.error('STAGE_19_3_ABORTED:', e.message); process.exitCode = 1; }
}
module.exports = { install, updatedModuleTs, updatedModuleHtml, mergeLocale, strings };
