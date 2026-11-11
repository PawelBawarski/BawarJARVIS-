'use strict';
/** Use with: npx electron-builder --config electron-builder.stage17-2.config.cjs --win nsis
 * Reuses the project's EXISTING builder configuration; never replaces it.
 */
const fs = require('node:fs');
const path = require('node:path');
const root = __dirname;

function loadBase() {
  const candidates = [
    'electron-builder.config.cjs', 'desktop/electron-builder.config.cjs',
    'electron-builder.config.js', 'desktop/electron-builder.config.js',
  ];
  for (const candidate of candidates) {
    const file = path.join(root, candidate);
    if (!fs.existsSync(file)) continue;
    let config = require(file);
    if (config && typeof config === 'object' && config.default) config = config.default;
    if (!config || typeof config !== 'object' || Array.isArray(config)) {
      throw new Error(`Nieobsługiwany format konfiguracji: ${candidate}`);
    }
    return config;
  }
  for (const relative of ['package.json', 'desktop/package.json']) {
    const file = path.join(root, relative);
    if (!fs.existsSync(file)) continue;
    const json = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (json.build && typeof json.build === 'object' && !Array.isArray(json.build)) return json.build;
  }
  throw new Error('Brak bazowej konfiguracji electron-builder CJS/JS/package.json. Nie buduję instalatora bez istniejących ustawień bezpieczeństwa.');
}

const base = loadBase();
const existing = base.extraResources == null ? [] :
  (Array.isArray(base.extraResources) ? base.extraResources : [base.extraResources]);
const normalizeTo = entry => typeof entry === 'object' && entry && entry.to
  ? String(entry.to).replace(/\\/g, '/').replace(/^\.?\//, '').replace(/\/$/, '') : '';
const normalizeFrom = entry => typeof entry === 'object' && entry && entry.from
  ? String(entry.from).replace(/\\/g, '/') : '';
// Supersede only an exact legacy mapping to the same JAR filename.
// This changes this build's mapping; the original config is never modified.
const safeExisting = existing.filter(item => normalizeTo(item) !== 'backend/jarvis-backend.jar');
const bundled = [
  { from: 'desktop/resources/java', to: 'java', filter: ['**/*'] },
  { from: 'desktop/resources/backend', to: 'backend', filter: ['jarvis-backend.jar', 'stage17-2-manifest.json'] },
];
for (const entry of bundled) {
  const collision = safeExisting.find(item => normalizeTo(item) === entry.to || normalizeTo(item).startsWith(entry.to + '/'));
  if (collision) {
    if (normalizeFrom(collision) === entry.from && normalizeTo(collision) === entry.to) {
      // Already bundled exactly once by the project's original configuration.
      continue;
    }
    throw new Error(`Konflikt extraResources dla ${entry.to}. Nie nadpisuję konfiguracji instalatora.`);
  }
  if (!fs.existsSync(path.join(root, entry.from))) {
    throw new Error(`Brakuje zasobów: ${entry.from}. Najpierw przygotuj etap 17.2.`);
  }
}
const additions = bundled.filter(entry => !safeExisting.some(item => normalizeFrom(item) === entry.from && normalizeTo(item) === entry.to));
module.exports = { ...base, extraResources: [...safeExisting, ...additions] };
