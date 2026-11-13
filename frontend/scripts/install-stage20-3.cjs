#!/usr/bin/env node
'use strict';
/** Idempotent 20.3 integration. New backend classes are added by patch; only minimal edits here. */
const fs = require('node:fs');
const path = require('node:path');

const additions = {
  pl: {
    'memory.semantic.title': 'Wyszukiwanie semantyczne (lokalne)',
    'memory.semantic.description': 'Szuka podobnych znaczeniowo fragmentów, nawet jeśli używasz innych słów. Wymaga osobnego modelu embeddingowego.',
    'memory.semantic.refresh': 'Sprawdź konfigurację',
    'memory.semantic.configured': 'Embeddingi włączone (nie oznacza gotowości modelu)',
    'memory.semantic.disabled': 'Embeddingi wyłączone — działa wyszukiwanie tekstowe',
    'memory.semantic.model': 'Model',
    'memory.semantic.indexed': 'Wpisy z zapisanym wektorem',
    'memory.semantic.statusNotHealth': 'Stan konfiguracji nie jest testem dostępności modelu. Nowe dokumenty wymagają ręcznej indeksacji.',
    'memory.semantic.checkStatus': 'Sprawdź status, aby zobaczyć liczbę zindeksowanych fragmentów.',
    'memory.semantic.index': 'Indeksuj kolejne 5 fragmentów',
    'memory.semantic.query': 'Zapytanie do pamięci',
    'memory.semantic.search': 'Szukaj w pamięci',
    'memory.semantic.working': 'Trwa lokalne przetwarzanie…',
    'memory.semantic.results': 'Znalezione fragmenty',
    'memory.semantic.methodSemantic': 'Semantycznie',
    'memory.semantic.methodText': 'Tekstowo (fallback)',
    'memory.semantic.noResults': 'Nie znaleziono dopasowanych fragmentów.',
    'memory.semantic.privacy': 'Dokumenty nie opuszczają komputera. Model embeddingowy działa osobno na 127.0.0.1:8766. Brak automatycznej indeksacji i zapisywania rozmów.',
    'memory.semantic.indexDone': 'Zapisano kolejną partię embeddingów.',
    'memory.semantic.indexUpToDate': 'W najnowszym zakresie nie ma nowych wpisów do indeksowania.',
    'memory.semantic.invalidQuery': 'Wpisz zapytanie od 1 do 500 znaków.',
    'memory.semantic.offline': 'Lokalny model embeddingowy nie odpowiada. Sprawdź port 8766.',
    'memory.semantic.requestError': 'Nie udało się wykonać operacji. Sprawdź połączenie z backendem.'
  },
  en: {
    'memory.semantic.title': 'Semantic search (local)',
    'memory.semantic.description': 'Finds passages with similar meaning even when you use different wording. Requires a separate embedding model.',
    'memory.semantic.refresh': 'Check configuration',
    'memory.semantic.configured': 'Embeddings enabled (not proof the model is online)',
    'memory.semantic.disabled': 'Embeddings disabled — text search still works',
    'memory.semantic.model': 'Model',
    'memory.semantic.indexed': 'Records with stored vectors',
    'memory.semantic.statusNotHealth': 'Configuration is not a model health check. New documents need manual indexing.',
    'memory.semantic.checkStatus': 'Check status to see indexed passages.',
    'memory.semantic.index': 'Index the next 5 passages',
    'memory.semantic.query': 'Memory search query',
    'memory.semantic.search': 'Search memory',
    'memory.semantic.working': 'Processing locally…',
    'memory.semantic.results': 'Matching passages',
    'memory.semantic.methodSemantic': 'Semantic',
    'memory.semantic.methodText': 'Text fallback',
    'memory.semantic.noResults': 'No matching passages found.',
    'memory.semantic.privacy': 'Documents stay on your computer. The embedding model runs separately on 127.0.0.1:8766. No automatic indexing or chat-memory collection.',
    'memory.semantic.indexDone': 'Indexed another batch of passages.',
    'memory.semantic.indexUpToDate': 'No new passages found within the current scan window.',
    'memory.semantic.invalidQuery': 'Enter a query between 1 and 500 characters.',
    'memory.semantic.offline': 'The local embedding model is unavailable. Check port 8766.',
    'memory.semantic.requestError': 'Operation failed. Check the backend connection.'
  }
};

function mergeLocale(before, addition) {
  const data = JSON.parse(before);
  if (!data || Array.isArray(data) || typeof data !== 'object') throw new Error('INVALID_LOCALE');
  const missing = Object.entries(addition).filter(([key]) => !Object.hasOwn(data, key));
  if (!missing.length) return before;
  const eol = before.includes('\r\n') ? '\r\n' : '\n';
  const i = before.lastIndexOf('}');
  if (i < 0) throw new Error('INVALID_LOCALE');
  const prefix = before.slice(0, i).trimEnd();
  const comma = prefix.endsWith('{') ? '' : ',';
  const result = prefix + comma + eol + missing.map(([key, value]) =>
    '  ' + JSON.stringify(key) + ': ' + JSON.stringify(value)).join(',' + eol) + eol + before.slice(i);
  JSON.parse(result);
  return result;
}

function integrateResearchTs(source) {
  const line = "import { SemanticMemory } from './semantic-memory/semantic-memory';";
  let text = source.includes(line) ? source : line + '\n' + source;
  const match = /imports\s*:\s*\[([^\]]*)\]/s;
  if (!match.test(text)) throw new Error('RESEARCH_COMPONENT_IMPORTS_MISSING');
  text = text.replace(match, (whole, inner) => inner.includes('SemanticMemory') ? whole :
    'imports: [' + inner.trim() + (inner.trim() ? ', ' : '') + 'SemanticMemory]');
  return text;
}

function integrateResearchHtml(source) {
  if (source.includes('app-research-semantic-memory')) return source;
  const match = /<app-research-document-memory\b[^>]*\/>/;
  if (!match.test(source)) throw new Error('RESEARCH_DOCUMENT_PANEL_MISSING');
  return source.replace(match, all => '<app-research-semantic-memory />\n  ' + all);
}

function integrateChat(source) {
  const imp = 'import pl.bawar.jarvis.research.SemanticMemoryService;';
  let text = source.includes(imp) ? source : source.replace(/(package\s+[^;]+;)/, '$1\n\n' + imp);
  const field = 'private SemanticMemoryService semanticMemory;';
  if (!text.includes(field)) {
    const existing = /private\s+KnowledgeMemoryService\s+knowledge\s*;/;
    if (!existing.test(text)) throw new Error('CHAT_MEMORY_FIELD_MISSING');
    text = text.replace(existing, original => original + '\n    @org.springframework.beans.factory.annotation.Autowired(required = false)\n    ' + field);
  }
  if (text.includes('semanticMemory.augmentPrompt(message, knowledge)')) return text;
  const call = /knowledge\s*==\s*null\s*\?\s*message\s*:\s*knowledge\.augmentPrompt\(message\)/;
  if (!call.test(text)) throw new Error('CHAT_MEMORY_AUGMENT_MARKER_MISSING');
  return text.replace(call,
    'knowledge == null ? message : (semanticMemory == null ? knowledge.augmentPrompt(message) : semanticMemory.augmentPrompt(message, knowledge))');
}

function install(repo = path.resolve(__dirname, '../..')) {
  const paths = [
    ['frontend/src/app/features/ai-lab/research-memory/research-memory.ts', integrateResearchTs],
    ['frontend/src/app/features/ai-lab/research-memory/research-memory.html', integrateResearchHtml],
    ['backend/src/main/java/pl/bawar/jarvis/chat/api/ChatApplicationService.java', integrateChat],
    ...['pl', 'en'].map(lang => ['frontend/public/i18n/' + lang + '.json', contents => mergeLocale(contents, additions[lang])]),
  ];
  const staged = paths.map(([name, change]) => {
    const file = path.join(repo, name);
    const before = fs.readFileSync(file, 'utf8');
    return { file, before, after: change(before) };
  });
  const langs = staged.filter(entry => /[\\/]i18n[\\/](pl|en)\.json$/.test(entry.file));
  if (langs.length !== 2 || JSON.stringify(Object.keys(JSON.parse(langs[0].after)).sort()) !==
    JSON.stringify(Object.keys(JSON.parse(langs[1].after)).sort())) throw new Error('LOCALE_KEY_MISMATCH');
  for (const item of staged) {
    if (item.before === item.after) continue;
    if (!fs.existsSync(item.file + '.backup-before-stage-20-3'))
      fs.copyFileSync(item.file, item.file + '.backup-before-stage-20-3');
    fs.writeFileSync(item.file, item.after, 'utf8');
  }
  return Object.keys(JSON.parse(langs[0].after)).length;
}

if (require.main === module) {
  try { console.log('STAGE_20_3_OK: ' + install() + ' keys per language; chat and AI Lab integrated'); }
  catch (error) { console.error('STAGE_20_3_ABORTED:', error.message); process.exitCode = 1; }
}
module.exports = { additions, mergeLocale, integrateChat, integrateResearchTs, integrateResearchHtml, install };
