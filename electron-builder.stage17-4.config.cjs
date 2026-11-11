'use strict';
/** 17.4: reuse stage 17.3 build and map large LLM assets exactly once. */
const path = require('node:path');
const fs = require('node:fs');
const base = require('./electron-builder.stage17-3.config.cjs');
const from = 'desktop/ai-runtime';
const root = path.join(__dirname, from);
const manifest = path.join(root, 'stage17-4-manifest.json');
for (const rel of ['bin/llama-server.exe', 'models/Qwen3-8B-Q4_K_M.gguf', 'stage17-4-manifest.json']) {
  if (!fs.existsSync(path.join(root, rel))) throw new Error(`Brak zasobów Qwen: ${rel}. Uruchom 17.4 --prepare.`);
}
if (JSON.parse(fs.readFileSync(manifest, 'utf8')).schema !== 'jarvis.ai17.4.v1') {
  throw new Error('Nieznany manifest AI.');
}
const existing = Array.isArray(base.extraResources) ? base.extraResources : [];
const norm = value => String(value ?? '').replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/$/, '');
const matches = existing.filter(e => typeof e === 'object' && (norm(e.to) === 'llm' || norm(e.to).startsWith('llm/')));
if (matches.some(e => norm(e.from) !== from || norm(e.to) !== 'llm') || matches.length > 1) {
  throw new Error('Konflikt zasobów llm w bazowej konfiguracji; nie duplikuję modelu.');
}
// Package only the reviewed runtime, the selected model and license notices.
// The source folder may contain other local models or developer artifacts.
const filter = [
  'bin/**/*', 'models/Qwen3-8B-Q4_K_M.gguf', 'stage17-4-manifest.json',
  'licenses/**/*', 'LICENSE*', 'THIRD_PARTY_NOTICES*',
];
module.exports = {
  ...base,
  extraResources: [
    ...existing.filter(e => !(typeof e === 'object' && norm(e.to) === 'llm')),
    { from, to: 'llm', filter },
  ],
};
