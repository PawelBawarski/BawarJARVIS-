'use strict';
// Run ONCE on the development machine. Does not overwrite an existing private config.
const fs = require('node:fs');
const path = require('node:path');
const { parseEnv, configPath } = require('../electron/backend-runtime.cjs');

const root = path.resolve(__dirname, '../../');
const sourcePath = path.join(root, 'backend', '.env.jarvis');
let targetPath;
try { targetPath = configPath(); }
catch (e) { console.error(e.message); process.exit(1); }

if (!fs.existsSync(sourcePath)) {
  console.error('Brak backend/.env.jarvis. Najpierw skonfiguruj bazę z BE 11.2.');
  process.exit(1);
}
if (fs.existsSync(targetPath)) {
  console.log('SKIP: prywatna konfiguracja już istnieje:', targetPath);
  process.exit(0);
}
const source = fs.readFileSync(sourcePath, 'utf8');
const parsed = parseEnv(source);
if (!parsed.JARVIS_DB_PASSWORD || parsed.JARVIS_DB_PASSWORD === 'change_this_to_a_unique_local_password') {
  console.error('Ustaw prawdziwe hasło w backend/.env.jarvis przed kopiowaniem.');
  process.exit(1);
}
fs.mkdirSync(path.dirname(targetPath), { recursive: true });
fs.writeFileSync(targetPath, source, { flag: 'wx', mode: 0o600 });
console.log('OK: zapisano lokalną konfigurację:', targetPath);
console.log('Uwaga: backend.env zawiera hasło bazy. Nie dodawaj go do Git ani nie udostępniaj.');
