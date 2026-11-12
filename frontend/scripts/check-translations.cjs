'use strict';
const { readFileSync, readdirSync } = require('node:fs');
const { join } = require('node:path');
const assert = require('node:assert/strict');
const pl = JSON.parse(readFileSync(join(__dirname, '..', 'public/i18n/pl.json'), 'utf8'));
const en = JSON.parse(readFileSync(join(__dirname, '..', 'public/i18n/en.json'), 'utf8'));
assert.deepEqual(Object.keys(pl).sort(), Object.keys(en).sort(), 'PL and EN must have matching keys');
for (const [key, value] of Object.entries(pl)) assert.ok(value.trim(), `Empty PL: ${key}`);
for (const [key, value] of Object.entries(en)) assert.ok(value.trim(), `Empty EN: ${key}`);
// All static template translation keys must exist in both languages.
function scanTemplates(folder) {
  for (const item of readdirSync(folder, { withFileTypes: true })) {
    const file = join(folder, item.name);
    if (item.isDirectory()) { scanTemplates(file); continue; }
    if (!item.name.endsWith('.html')) continue;
    const html = readFileSync(file, 'utf8');
    for (const [, key] of html.matchAll(/["']([a-z][\w.-]+)["']\s*\|\s*translate/g)) {
      assert.ok(Object.hasOwn(pl, key), `Missing translation ${key} in ${file}`);
    }
  }
}
scanTemplates(join(__dirname, '..', 'src/app'));
console.log(`TRANSLATIONS_OK: ${Object.keys(pl).length} keys per language; static template keys verified`);
