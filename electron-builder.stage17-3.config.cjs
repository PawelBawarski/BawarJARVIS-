'use strict';
/** Stage 17.3: layer PostgreSQL onto the secure 17.2 electron-builder config. */
const fs = require('node:fs');
const path = require('node:path');
const base = require('./electron-builder.stage17-2.config.cjs');
const postgres = path.join(__dirname, 'desktop', 'resources', 'postgres');
for (const file of ['bin/postgres.exe', 'bin/pg_ctl.exe', 'bin/initdb.exe', 'bin/pg_restore.exe', 'share/postgres.bki']) {
  if (!fs.existsSync(path.join(postgres, file))) throw new Error(`Brak PostgreSQL 17 w resources/postgres/${file}. Uruchom --stage.`);
}
const existing = Array.isArray(base.extraResources) ? base.extraResources : [];
const norm = value => String(value || '').replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/$/, '');
if (existing.some(e => typeof e === 'object' &&
  (norm(e.to) === 'postgres' || norm(e.to).startsWith('postgres/')))) {
  throw new Error('Konflikt extraResources: postgres. Nie nadpisuję istniejącego mapowania.');
}
module.exports = {
  ...base,
  extraResources: [...existing, { from: 'desktop/resources/postgres', to: 'postgres', filter: ['**/*'] }],
};
