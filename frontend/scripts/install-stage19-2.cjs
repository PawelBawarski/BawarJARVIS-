#!/usr/bin/env node
'use strict';
/** Idempotent PL/EN key integration; preserves the existing dictionary and line endings. */
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const texts = {
  pl: {
    'lab.isolated.title': 'Weryfikacja w izolacji (Docker)',
    'lab.isolated.description': 'Uruchom oddzielną kontrolę proponowanego pliku przed decyzją o zapisie. Kod nie trafia do projektu.',
    'lab.isolated.disabled': 'Weryfikacja jest wyłączona. Włącz ją świadomie w konfiguracji Spring Boot.',
    'lab.isolated.scope': 'Kontrola tylko jednego pliku. Brak sieci i dostępu do plików projektu.',
    'lab.isolated.run': 'Uruchom weryfikację',
    'lab.isolated.running': 'Trwa sprawdzanie w kontenerze…',
    'lab.isolated.mode': 'Rodzaj kontroli',
    'lab.isolated.hash': 'Skrót propozycji (SHA-256)',
    'lab.isolated.status.passed': 'Kontrola zakończona powodzeniem',
    'lab.isolated.status.failed': 'Wykryto problem',
    'lab.isolated.status.timeout': 'Przekroczono czas',
    'lab.isolated.status.unavailable': 'Brak środowiska Docker',
    'lab.isolated.limits': 'PASS nie oznacza bezpieczeństwa ani pełnego przejścia testów Angular/Spring Boot. Wynik dotyczy wyłącznie tego pliku.',
    'lab.isolated.error': 'Nie udało się przeprowadzić kontroli. Nie zmieniono żadnych plików.',
  },
  en: {
    'lab.isolated.title': 'Isolated check (Docker)',
    'lab.isolated.description': 'Run a separate check on the proposed file before deciding whether to save it. The project is not modified.',
    'lab.isolated.disabled': 'Checks are disabled. Explicitly enable them in the Spring Boot configuration.',
    'lab.isolated.scope': 'Single-file check only. No network or access to project files.',
    'lab.isolated.run': 'Run check',
    'lab.isolated.running': 'Checking in an isolated container…',
    'lab.isolated.mode': 'Check mode',
    'lab.isolated.hash': 'Proposal fingerprint (SHA-256)',
    'lab.isolated.status.passed': 'Check passed',
    'lab.isolated.status.failed': 'Check failed',
    'lab.isolated.status.timeout': 'Time limit exceeded',
    'lab.isolated.status.unavailable': 'Docker unavailable',
    'lab.isolated.limits': 'PASS does not mean the code is safe or that all Angular/Spring Boot tests passed. The result covers only this file.',
    'lab.isolated.error': 'The check could not be completed. No files were changed.',
  },
};

function merge(content, extra) {
  const original = JSON.parse(content);
  const missing = [];
  for (const [key, value] of Object.entries(extra)) {
    if (Object.hasOwn(original, key)) {
      if (original[key] !== value) throw new Error(`Conflicting translation for: ${key}`);
    } else missing.push([key, value]);
  }
  if (!missing.length) return content;
  const newline = content.includes('\r\n') ? '\r\n' : '\n';
  const end = content.lastIndexOf('}');
  if (end < 0) throw new Error('Invalid translation JSON');
  const prefix = content.slice(0, end).trimEnd();
  const separator = prefix.endsWith('{') ? '' : ',';
  const additional = missing.map(([key, value]) => `  ${JSON.stringify(key)}: ${JSON.stringify(value)}`).join(',' + newline);
  const updated = prefix + separator + newline + additional + newline + content.slice(end);
  JSON.parse(updated);
  return updated;
}

function install(files = {
  pl: path.join(root, 'public/i18n/pl.json'),
  en: path.join(root, 'public/i18n/en.json'),
}) {
  const before = Object.fromEntries(Object.entries(files).map(([lang, file]) => [lang, fs.readFileSync(file, 'utf8')]));
  const after = Object.fromEntries(Object.keys(files).map(lang => [lang, merge(before[lang], texts[lang])]));
  const pl = JSON.parse(after.pl);
  const en = JSON.parse(after.en);
  if (JSON.stringify(Object.keys(pl).sort()) !== JSON.stringify(Object.keys(en).sort())) {
    throw new Error('PL/EN key sets differ; no files have been changed');
  }
  for (const lang of Object.keys(files)) {
    if (before[lang] === after[lang]) continue;
    const backup = files[lang] + '.backup-before-stage-19-2';
    if (!fs.existsSync(backup)) fs.copyFileSync(files[lang], backup);
    fs.writeFileSync(files[lang], after[lang], 'utf8');
  }
  return Object.keys(pl).length;
}

if (require.main === module) {
  try { console.log(`STAGE_19_2_I18N_OK: ${install()} keys in each language`); }
  catch (e) { console.error('STAGE_19_2_I18N_ABORTED:', e.message); process.exitCode = 1; }
}
module.exports = { merge, install, texts };
