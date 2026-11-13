#!/usr/bin/env node
'use strict';
/** Idempotent stage-20.2 integration; never replaces existing locale entries or secrets. */
const fs = require('node:fs');
const path = require('node:path');

const additions = {
  pl: {
    'memory.documents.title': 'Dokumenty w pamięci J.A.R.V.I.S.',
    'memory.documents.description': 'Dodaj PDF, TXT lub Markdown. J.A.R.V.I.S. zapisze tekst w lokalnej bazie i udostępni go do wyszukiwania.',
    'memory.documents.choose': 'Wybierz dokument do importu',
    'memory.documents.limit': 'Maksymalnie 3 MB, PDF do 60 stron. Skanowane PDF bez tekstu wymagają OCR (jeszcze nieobsługiwane).',
    'memory.documents.selected': 'Wybrano',
    'memory.documents.import': 'Zatwierdź import dokumentu',
    'memory.documents.refresh': 'Odśwież listę dokumentów',
    'memory.documents.working': 'Przetwarzanie dokumentów…',
    'memory.documents.saved': 'Dokument zapisany w pamięci. Fragmenty są dostępne do wyszukiwania w Chat.',
    'memory.documents.deleted': 'Usunięto dokument i wszystkie powiązane fragmenty.',
    'memory.documents.listTitle': 'Zapisane dokumenty',
    'memory.documents.empty': 'Nie dodano jeszcze dokumentów.',
    'memory.documents.fragments': 'fragmentów',
    'memory.documents.delete': 'Usuń',
    'memory.documents.confirmDelete': 'Usunąć dokument i wszystkie jego fragmenty?',
    'memory.documents.cancel': 'Anuluj',
    'memory.documents.privacy': 'Import jest ręczny. W bazie pozostaje wyodrębniony tekst, a nie oryginalny plik. Nie importuj haseł ani sekretów. Treść dokumentów jest traktowana jako dane, nie polecenia.',
    'memory.documents.invalidFile': 'Wybierz plik .pdf, .txt lub .md o rozmiarze do 3 MB.',
    'memory.documents.requestError': 'Operacja na dokumentach nie powiodła się. Sprawdź format, limit danych i połączenie ze Spring Boot.',
    'memory.documents.duplicate': 'Ten dokument jest już zapisany w pamięci (ten sam SHA-256).',
    'memory.documents.noText': 'W dokumencie nie znaleziono tekstu. Skanowany PDF wymaga OCR.',
    'memory.documents.invalidPdf': 'Nie udało się odczytać pliku PDF.',
    'memory.documents.pdfRestricted': 'PDF jest zabezpieczony lub przekracza limit 60 stron.',
    'memory.documents.invalidUtf8': 'Plik tekstowy musi mieć kodowanie UTF-8.',
    'memory.documents.textTooLarge': 'Wyodrębniony tekst przekracza limit 150 000 znaków.'
  },
  en: {
    'memory.documents.title': 'Documents in J.A.R.V.I.S. memory',
    'memory.documents.description': 'Import PDF, TXT or Markdown. Extracted text is saved locally and made searchable.',
    'memory.documents.choose': 'Choose a document to import',
    'memory.documents.limit': 'Up to 3 MB; PDF up to 60 pages. Scanned PDFs without text need OCR (not yet supported).',
    'memory.documents.selected': 'Selected',
    'memory.documents.import': 'Confirm document import',
    'memory.documents.refresh': 'Refresh documents',
    'memory.documents.working': 'Processing documents…',
    'memory.documents.saved': 'Document saved. Its chunks can now be retrieved by Chat.',
    'memory.documents.deleted': 'Document and all associated chunks deleted.',
    'memory.documents.listTitle': 'Saved documents',
    'memory.documents.empty': 'No documents imported yet.',
    'memory.documents.fragments': 'chunks',
    'memory.documents.delete': 'Delete',
    'memory.documents.confirmDelete': 'Delete this document and all its chunks?',
    'memory.documents.cancel': 'Cancel',
    'memory.documents.privacy': 'Import is always manual. Extracted text is stored in the database, not the original file. Do not import passwords or secrets. Document text is treated as data, not commands.',
    'memory.documents.invalidFile': 'Select a .pdf, .txt or .md file up to 3 MB.',
    'memory.documents.requestError': 'Document operation failed. Check the file format, size limits and Spring Boot connectivity.',
    'memory.documents.duplicate': 'This document is already imported (matching SHA-256).',
    'memory.documents.noText': 'No selectable text found. Scanned PDFs require OCR.',
    'memory.documents.invalidPdf': 'Unable to read the PDF document.',
    'memory.documents.pdfRestricted': 'The PDF is protected or exceeds the 60-page limit.',
    'memory.documents.invalidUtf8': 'Text files must use UTF-8 encoding.',
    'memory.documents.textTooLarge': 'Extracted text exceeds the 150,000-character limit.'
  }
};

function mergeLocale(before, addition) {
  const data = JSON.parse(before);
  if (!data || Array.isArray(data) || typeof data !== 'object') throw new Error('INVALID_LOCALE');
  const missing = Object.entries(addition).filter(([key]) => !Object.hasOwn(data, key));
  if (!missing.length) return before;
  const eol = before.includes('\r\n') ? '\r\n' : '\n';
  const index = before.lastIndexOf('}');
  if (index < 0) throw new Error('INVALID_LOCALE');
  const opening = before.slice(0, index).trimEnd();
  const comma = opening.endsWith('{') ? '' : ',';
  const result = opening + comma + eol + missing.map(([key, value]) =>
    '  ' + JSON.stringify(key) + ': ' + JSON.stringify(value)).join(',' + eol) + eol + before.slice(index);
  JSON.parse(result);
  return result;
}

function integrateComponent(ts) {
  const importLine = "import { DocumentMemory } from './document-memory/document-memory';";
  let result = ts.includes(importLine) ? ts : importLine + '\n' + ts;
  if (/imports\s*:\s*\[[^\]]*\]/s.test(result)) {
    result = result.replace(/imports\s*:\s*\[([^\]]*)\]/s, (all, inner) =>
      inner.includes('DocumentMemory') ? all : 'imports: [' + inner.trim() + (inner.trim() ? ', ' : '') + 'DocumentMemory]');
  } else if (/standalone\s*:\s*true/.test(result)) {
    result = result.replace(/standalone\s*:\s*true\s*,?/, 'standalone: true, imports: [DocumentMemory],');
  } else {
    throw new Error('RESEARCH_COMPONENT_MARKER_MISSING');
  }
  return result;
}

function integrateHtml(html) {
  if (html.includes('<app-research-document-memory')) return html;
  const marker = /<section\b[^>]*data-testid="memory-local-note"[^>]*>/;
  if (!marker.test(html)) throw new Error('RESEARCH_HTML_MARKER_MISSING');
  return html.replace(marker, match => '<app-research-document-memory />\n  ' + match);
}

function integratePom(pom) {
  if (/<artifactId>pdfbox<\/artifactId>/.test(pom)) return pom;
  const closing = '</dependencies>';
  if (!pom.includes(closing)) throw new Error('POM_DEPENDENCIES_MISSING');
  const dependency = [
    '        <!-- 20.2: offline PDF text extraction, no OCR or script execution -->',
    '        <dependency>',
    '            <groupId>org.apache.pdfbox</groupId>',
    '            <artifactId>pdfbox</artifactId>',
    '            <version>3.0.8</version>',
    '        </dependency>',
    '    '
  ].join('\n');
  return pom.replace(closing, dependency + closing);
}

function integrateProperties(properties) {
  const additions = [
    ['spring.servlet.multipart.max-file-size', '4MB'],
    ['spring.servlet.multipart.max-request-size', '4MB']
  ];
  let result = properties;
  for (const [key, value] of additions) {
    if (new RegExp('^\\s*' + key.replace(/\./g, '\\.') + '\\s*=', 'm').test(result)) continue;
    result = result.replace(/\s*$/, '') + '\n' + key + '=' + value + '\n';
  }
  return result;
}

function install(repoRoot = path.resolve(__dirname, '../..')) {
  const root = path.resolve(repoRoot);
  const front = path.join(root, 'frontend');
  const changes = [
    [path.join(front, 'src/app/features/ai-lab/research-memory/research-memory.ts'), integrateComponent],
    [path.join(front, 'src/app/features/ai-lab/research-memory/research-memory.html'), integrateHtml],
    [path.join(root, 'backend/pom.xml'), integratePom],
    [path.join(root, 'backend/src/main/resources/application.properties'), integrateProperties],
    ...['pl', 'en'].map(lang => [path.join(front, 'public/i18n', lang + '.json'), text => mergeLocale(text, additions[lang])])
  ];
  // Complete all validation before mutating files; do not overwrite any existing translations.
  const staged = changes.map(([file, convert]) => {
    const before = fs.readFileSync(file, 'utf8');
    return { file, before, after: convert(before) };
  });
  const pl = staged.find(item => item.file.endsWith('pl.json'));
  const en = staged.find(item => item.file.endsWith('en.json'));
  const keys = lang => Object.keys(JSON.parse(lang.after)).sort();
  if (JSON.stringify(keys(pl)) !== JSON.stringify(keys(en))) throw new Error('LOCALE_KEY_MISMATCH');
  for (const item of staged) {
    if (item.before === item.after) continue;
    const backup = item.file + '.backup-before-stage-20-2';
    if (!fs.existsSync(backup)) fs.copyFileSync(item.file, backup);
    fs.writeFileSync(item.file, item.after, 'utf8');
  }
  return keys(pl).length;
}

if (require.main === module) {
  try { console.log('STAGE_20_2_OK: ' + install() + ' translation keys per language'); }
  catch (error) { console.error('STAGE_20_2_ABORTED:', error.message); process.exitCode = 1; }
}
module.exports = { mergeLocale, integrateComponent, integrateHtml, integratePom, integrateProperties, install, additions };
