'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { additions, integrateChat, integrateResearchTs, integrateResearchHtml, install, mergeLocale } = require('./install-stage20-3.cjs');

test('translation merge preserves overrides and is repeatable', () => {
  const text = '{"memory.semantic.title":"Custom","existing":"Keep"}';
  const updated = mergeLocale(text, additions.en);
  assert.equal(mergeLocale(updated, additions.en), updated);
  assert.equal(JSON.parse(updated)['memory.semantic.title'], 'Custom');
});

test('Chat integration keeps the pre-existing lexical path when semantic is absent', () => {
  const source = 'package pl.bawar.jarvis.chat.api;\nclass ChatApplicationService {\n' +
    'private KnowledgeMemoryService knowledge;\n' +
    'String prompt = knowledge == null ? message : knowledge.augmentPrompt(message);\n}';
  const result = integrateChat(source);
  assert.equal(integrateChat(result), result);
  assert.match(result, /semanticMemory == null \? knowledge\.augmentPrompt\(message\)/);
});

test('installs panel, translations and Chat integration without duplicate changes', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-20-3-'));
  try {
    const make = (name, content) => {
      const full = path.join(root, name);
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, content);
    };
    make('frontend/src/app/features/ai-lab/research-memory/research-memory.ts',
      '@Component({standalone:true,imports:[DocumentMemory]})\nexport class ResearchMemory {}');
    make('frontend/src/app/features/ai-lab/research-memory/research-memory.html',
      '<section><app-research-document-memory /></section>');
    make('backend/src/main/java/pl/bawar/jarvis/chat/api/ChatApplicationService.java',
      'package pl.bawar.jarvis.chat.api;\nclass ChatApplicationService {private KnowledgeMemoryService knowledge;\n' +
      'String q = knowledge == null ? message : knowledge.augmentPrompt(message);\n}');
    make('frontend/public/i18n/pl.json', '{"previous":"stary"}');
    make('frontend/public/i18n/en.json', '{"previous":"old"}');
    const first = install(root);
    const after = fs.readFileSync(path.join(root, 'frontend/src/app/features/ai-lab/research-memory/research-memory.ts'), 'utf8');
    assert.equal(install(root), first);
    assert.equal(fs.readFileSync(path.join(root, 'frontend/src/app/features/ai-lab/research-memory/research-memory.ts'), 'utf8'), after);
    assert.match(after, /SemanticMemory/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
