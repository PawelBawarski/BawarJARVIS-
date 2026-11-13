#!/usr/bin/env node
'use strict';
/** Idempotent locale extension, preserving all existing translations and files. */
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const additions = {
  "pl": {
    "memory.local.title": "Własna pamięć lokalna",
    "memory.local.intro": "Zapisuj wyłącznie informacje, które chcesz świadomie zachować w PostgreSQL.",
    "memory.local.noteTitle": "Tytuł notatki",
    "memory.local.noteContent": "Treść notatki (maksymalnie 4000 znaków)",
    "memory.local.save": "Zapisz w pamięci",
    "memory.local.saved": "Notatka zapisana w lokalnej pamięci.",
    "memory.local.privacy": "J.A.R.V.I.S. nie zapisuje automatycznie rozmów. Notatki możesz usunąć z listy poniżej.",
    "memory.local.searchTitle": "Wyszukaj w zapisanej pamięci",
    "memory.local.searchDetails": "Lokalne wyszukiwanie tekstowe w zatwierdzonych notatkach i źródłach. Bez wysyłania danych do internetu.",
    "memory.local.searchLabel": "Czego szukasz?",
    "memory.local.searchButton": "Znajdź w pamięci",
    "memory.local.noMatches": "Brak pasujących wpisów.",
    "memory.local.found": "Dopasowane wpisy",
    "memory.local.localLabel": "Notatka lokalna — bez zewnętrznego odnośnika"
  },
  "en": {
    "memory.local.title": "Personal local memory",
    "memory.local.intro": "Save only the information you explicitly want to retain in PostgreSQL.",
    "memory.local.noteTitle": "Note title",
    "memory.local.noteContent": "Note content (up to 4,000 characters)",
    "memory.local.save": "Save to memory",
    "memory.local.saved": "Note saved to local memory.",
    "memory.local.privacy": "J.A.R.V.I.S. never automatically saves conversations as notes. You can delete saved notes below.",
    "memory.local.searchTitle": "Search saved knowledge",
    "memory.local.searchDetails": "Local text search across approved notes and sources. No data is sent to the internet.",
    "memory.local.searchLabel": "Search phrase",
    "memory.local.searchButton": "Search memory",
    "memory.local.noMatches": "No matching entries.",
    "memory.local.found": "Matching entries",
    "memory.local.localLabel": "Local note — no external link"
  }
};

function merge(contents, extra) {
  const previous = JSON.parse(contents);
  const missing = Object.entries(extra).filter(([key]) => !Object.hasOwn(previous, key));
  if (!missing.length) return contents;
  const eol = contents.includes('\r\n') ? '\r\n' : '\n';
  const ending = contents.lastIndexOf('}');
  if (ending < 0) throw new Error('INVALID_LOCALE');
  const start = contents.slice(0, ending).trimEnd();
  const join = start.endsWith('{') ? '' : ',';
  const result = start + join + eol + missing.map(([k, v]) =>
    '  ' + JSON.stringify(k) + ': ' + JSON.stringify(v)).join(',' + eol) + eol + contents.slice(ending);
  JSON.parse(result);
  return result;
}
function install(base = root) {
  const files = Object.fromEntries(['pl','en'].map(lang =>
    [lang, path.join(base,'public','i18n',lang + '.json')]));
  const before = Object.fromEntries(Object.entries(files).map(([lang, file]) =>
    [lang, fs.readFileSync(file,'utf8')]));
  const after = Object.fromEntries(['pl','en'].map(lang =>
    [lang,merge(before[lang],additions[lang])]));
  const keyList = lang => Object.keys(JSON.parse(after[lang])).sort();
  if (JSON.stringify(keyList('pl')) !== JSON.stringify(keyList('en')))
    throw new Error('LOCALE_KEY_MISMATCH');
  for (const lang of ['pl','en']) {
    if (before[lang] === after[lang]) continue;
    const backup = files[lang] + '.backup-before-stage-20-1';
    if (!fs.existsSync(backup)) fs.copyFileSync(files[lang],backup);
    fs.writeFileSync(files[lang],after[lang],'utf8');
  }
  return keyList('pl').length;
}
if (require.main === module) {
  try { console.log('STAGE_20_1_OK: PL/EN ' + install() + ' keys'); }
  catch (error) { console.error('STAGE_20_1_ABORTED:',error.message); process.exitCode = 1; }
}
module.exports = { merge,install,additions };
