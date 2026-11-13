#!/usr/bin/env node
'use strict';
/** Safe, repeatable integration: no wholesale replacement of evolving Chat or i18n files. */
const fs = require('node:fs');
const path = require('node:path');

const locales = {
  pl: {
    'rag.sources.title': 'Źródła w pamięci',
    'rag.sources.description': 'Sprawdź fragmenty pasujące do ostatniego pytania.',
    'rag.sources.inspect': 'Sprawdź źródła',
    'rag.sources.notCitations': 'To aktualne wyniki wyszukiwania, nie potwierdzenie źródeł wykorzystanych przez Qwen w odpowiedzi.',
    'rag.sources.loading': 'Szukam w lokalnej pamięci…',
    'rag.sources.error': 'Nie mogę pobrać źródeł. Sprawdź połączenie z backendem.',
    'rag.sources.empty': 'Brak dopasowanych źródeł w lokalnej pamięci.',
    'rag.sources.semantic': 'Dopasowanie semantyczne',
    'rag.sources.text': 'Dopasowanie tekstowe'
  },
  en: {
    'rag.sources.title': 'Sources in memory',
    'rag.sources.description': 'Inspect passages matching the latest question.',
    'rag.sources.inspect': 'Inspect sources',
    'rag.sources.notCitations': 'These are current retrieval results, not proof of which sources Qwen used in its answer.',
    'rag.sources.loading': 'Searching local memory…',
    'rag.sources.error': 'Cannot retrieve sources. Check the backend connection.',
    'rag.sources.empty': 'No matching sources in local memory.',
    'rag.sources.semantic': 'Semantic match',
    'rag.sources.text': 'Text match'
  }
};

function patchChatTs(source) {
  const imp = "import { ChatRagSources } from '../chat-rag-sources/chat-rag-sources';";
  let next = source.includes(imp) ? source : imp + '\n' + source;
  const metadata = /\bimports\s*:\s*\[([^\]]*)\]/;
  if (!metadata.test(next)) throw new Error('CHAT_COMPONENT_IMPORTS_NOT_FOUND');
  next = next.replace(metadata, (full, content) => content.split(',').map(s => s.trim()).includes('ChatRagSources') ? full
    : `imports: [${content.trim()}${content.trim() ? ', ' : ''}ChatRagSources]`);
  return next;
}

function patchChatHtml(source) {
  if (source.includes('<app-chat-rag-sources')) return source;
  if (!/<\/main>\s*<footer\b/s.test(source)) throw new Error('CHAT_MAIN_FOOTER_NOT_FOUND');
  return source.replace(/(<\/main>)(\s*<footer\b)/s, '$1\n  <app-chat-rag-sources />$2');
}

function mergeLocale(source, additions) {
  const parsed = JSON.parse(source);
  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') throw new Error('INVALID_LOCALE_JSON');
  const missing = Object.entries(additions).filter(([key]) => !Object.hasOwn(parsed, key));
  if (!missing.length) return source;
  const eol = source.includes('\r\n') ? '\r\n' : '\n';
  const index = source.lastIndexOf('}');
  if (index === -1) throw new Error('INVALID_LOCALE_JSON');
  const before = source.slice(0, index).trimEnd();
  const comma = before.endsWith('{') ? '' : ',';
  const after = before + comma + eol + missing.map(([key, value]) =>
    '  ' + JSON.stringify(key) + ': ' + JSON.stringify(value)).join(',' + eol) + eol + source.slice(index);
  JSON.parse(after);
  return after;
}

function install(root = path.resolve(__dirname, '../..')) {
  const jobs = [
    ['frontend/src/app/features/chat/chat-view/chat-view.ts', patchChatTs],
    ['frontend/src/app/features/chat/chat-view/chat-view.html', patchChatHtml],
    ...(['pl', 'en'].map(language =>
      [`frontend/public/i18n/${language}.json`, before => mergeLocale(before, locales[language])]))
  ];
  // Prepare ALL edits in memory; fail before writing if a component has changed unexpectedly.
  const changes = jobs.map(([file, action]) => {
    const fullPath = path.join(root, file);
    const before = fs.readFileSync(fullPath, 'utf8');
    return { fullPath, before, after: action(before) };
  });
  const jsonPL = JSON.parse(changes[2].after), jsonEN = JSON.parse(changes[3].after);
  if (JSON.stringify(Object.keys(jsonPL).sort()) !== JSON.stringify(Object.keys(jsonEN).sort()))
    throw new Error('I18N_KEYS_DIFFER');
  for (const entry of changes) {
    if (entry.before === entry.after) continue;
    const backup = entry.fullPath + '.backup-before-stage20-4';
    if (!fs.existsSync(backup)) fs.copyFileSync(entry.fullPath, backup);
    fs.writeFileSync(entry.fullPath, entry.after, 'utf8');
  }
  return Object.keys(jsonPL).length;
}

if (require.main === module) {
  try { console.log(`STAGE_20_4_OK: Chat integrated, ${install()} matching PL/EN keys`); }
  catch (error) { console.error('STAGE_20_4_FAILED:', error.message); process.exitCode = 1; }
}
module.exports = { locales, patchChatTs, patchChatHtml, mergeLocale, install };
