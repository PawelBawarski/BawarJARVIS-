#!/usr/bin/env node
'use strict';
/** Idempotent translation migration; preserves all earlier keys and values. */
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const additions = {
  pl: {
    'lab.checkHistory.title': 'Historia weryfikacji projektu',
    'lab.checkHistory.description': 'Wyniki rzeczywistych testów kopii projektu. Możesz porównać dwie próby bez ponownego uruchamiania Dockera.',
    'lab.checkHistory.refresh': 'Pobierz historię testów',
    'lab.checkHistory.loading': 'Pobieranie historii…',
    'lab.checkHistory.error': 'Nie udało się pobrać historii. Spróbuj ponownie.',
    'lab.checkHistory.empty': 'Brak zapisanych wyników. Uruchom test projektu, a następnie odśwież historię.',
    'lab.checkHistory.count': 'Liczba zapisanych wyników',
    'lab.checkHistory.date': 'Data',
    'lab.checkHistory.target': 'Plik',
    'lab.checkHistory.status': 'Wynik',
    'lab.checkHistory.duration': 'Czas',
    'lab.checkHistory.first': 'Pierwsza próba',
    'lab.checkHistory.second': 'Druga próba',
    'lab.checkHistory.compared': 'Porównanie wyników',
    'lab.checkHistory.change': 'Inna propozycja kodu',
    'lab.checkHistory.yes': 'tak',
    'lab.checkHistory.no': 'nie',
    'lab.checkHistory.timeDiff': 'Różnica czasu (druga minus pierwsza)',
    'lab.checkHistory.notComparable': 'Wybrane próby dotyczą różnych plików lub typów projektu; nie można ich bezpośrednio porównać.',
    'lab.checkHistory.privacy': 'Historia zawiera tylko metadane testów. Kod źródłowy i logi nie są przechowywane. PASS nie oznacza zgody na zapis zmian.',
  },
  en: {
    'lab.checkHistory.title': 'Project verification history',
    'lab.checkHistory.description': 'Results of actual isolated project tests. Compare two runs without starting Docker again.',
    'lab.checkHistory.refresh': 'Load test history',
    'lab.checkHistory.loading': 'Loading test history…',
    'lab.checkHistory.error': 'Could not load the history. Please try again.',
    'lab.checkHistory.empty': 'No recorded checks. Run a project check and refresh the history.',
    'lab.checkHistory.count': 'Recorded checks',
    'lab.checkHistory.date': 'Date',
    'lab.checkHistory.target': 'File',
    'lab.checkHistory.status': 'Result',
    'lab.checkHistory.duration': 'Duration',
    'lab.checkHistory.first': 'First run',
    'lab.checkHistory.second': 'Second run',
    'lab.checkHistory.compared': 'Result comparison',
    'lab.checkHistory.change': 'Different code proposal',
    'lab.checkHistory.yes': 'yes',
    'lab.checkHistory.no': 'no',
    'lab.checkHistory.timeDiff': 'Duration difference (second minus first)',
    'lab.checkHistory.notComparable': 'Runs target different files or project types and cannot be directly compared.',
    'lab.checkHistory.privacy': 'History stores metadata only, never source code or logs. PASS does not grant permission to write files.',
  },
};
function merge(contents, extra) {
  const before = JSON.parse(contents);
  const missing = Object.entries(extra).filter(([key]) => !Object.hasOwn(before, key));
  if (!missing.length) return contents;
  const end = contents.lastIndexOf('}');
  if (end < 0) throw new Error('INVALID_LOCALE');
  const eol = contents.includes('\r\n') ? '\r\n' : '\n';
  const prefix = contents.slice(0, end).trimEnd();
  const separator = prefix.endsWith('{') ? '' : ',';
  const next = prefix + separator + eol + missing.map(([key, value]) =>
    `  ${JSON.stringify(key)}: ${JSON.stringify(value)}`).join(',' + eol) + eol + contents.slice(end);
  JSON.parse(next);
  return next;
}
function install(base = root) {
  const paths = Object.fromEntries(['pl', 'en'].map(lang =>
    [lang, path.join(base, 'public', 'i18n', lang + '.json')]));
  const prior = Object.fromEntries(Object.entries(paths).map(([lang, file]) =>
    [lang, fs.readFileSync(file, 'utf8')]));
  const output = Object.fromEntries(['pl', 'en'].map(lang =>
    [lang, merge(prior[lang], additions[lang])]));
  const pl = Object.keys(JSON.parse(output.pl)).sort();
  const en = Object.keys(JSON.parse(output.en)).sort();
  if (JSON.stringify(pl) !== JSON.stringify(en)) throw new Error('LOCALE_KEY_MISMATCH');
  for (const lang of ['pl', 'en']) {
    if (prior[lang] === output[lang]) continue;
    const backup = paths[lang] + '.backup-before-stage-19-5';
    if (!fs.existsSync(backup)) fs.copyFileSync(paths[lang], backup);
    fs.writeFileSync(paths[lang], output[lang], 'utf8');
  }
  return pl.length;
}
if (require.main === module) {
  try { console.log('STAGE_19_5_OK: PL/EN ' + install() + ' keys'); }
  catch (error) { console.error('STAGE_19_5_ABORTED:', error.message); process.exitCode = 1; }
}
module.exports = { merge, install, additions };
