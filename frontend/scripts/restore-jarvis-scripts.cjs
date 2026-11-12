'use strict';
/** J.A.R.V.I.S. — przywracanie wpisów npm scripts bez nadpisywania reszty package.json. */
const fs = require('node:fs');
const path = require('node:path');

const REQUIRED = {
  'dev:web': 'node scripts/dev-stack.cjs',
  'dev:electron': 'node scripts/dev-stack.cjs --electron',
  'test:electron': 'node --test electron/*.test.cjs',
  'dev:web:ai': 'node scripts/dev-stack.cjs --ai',
  'dev:electron:ai': 'node scripts/dev-stack.cjs --electron --ai',
  'test:model': 'node --test scripts/model-runtime.test.cjs',
  'check:i18n': 'node scripts/check-translations.cjs',
  'audit:styles': 'node scripts/audit-style-budgets.cjs'
};

function findProject() {
  const roots = [
    process.argv[2] ? path.resolve(process.argv[2]) : null,
    process.cwd(),
    path.join(process.cwd(), 'frontend'),
    path.resolve(__dirname, '..')
  ].filter(Boolean);
  for (const root of roots) {
    const file = path.join(root, 'package.json');
    if (!fs.existsSync(file)) continue;
    try {
      const json = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (json.name === 'jarvis') return { root, file, json };
    } catch (err) {
      throw new Error(`Nie można odczytać ${file}: ${err.message}`);
    }
  }
  throw new Error('Nie znaleziono package.json projektu jarvis. Uruchom skrypt z BawarJARVIS-/frontend.');
}

function main() {
  const { root, file, json } = findProject();
  const raw = fs.readFileSync(file, 'utf8');
  if (!json.scripts || typeof json.scripts !== 'object' || Array.isArray(json.scripts)) {
    json.scripts = {};
  }
  const changes = [];
  for (const [key, command] of Object.entries(REQUIRED)) {
    if (json.scripts[key] === command) continue;
    changes.push([key, json.scripts[key], command]);
    json.scripts[key] = command;
  }
  if (changes.length) {
    const backup = `${file}.backup-before-script-recovery`;
    // Back up only once: a second execution must not erase the original backup.
    if (!fs.existsSync(backup)) fs.copyFileSync(file, backup, fs.constants.COPYFILE_EXCL);
    const newline = raw.includes('\r\n') ? '\r\n' : '\n';
    const output = JSON.stringify(json, null, 2).replace(/\n/g, newline) + newline;
    const temporary = `${file}.jarvis-restore-tmp-${process.pid}`;
    try {
      fs.writeFileSync(temporary, output, 'utf8');
      fs.renameSync(temporary, file);
    } finally {
      if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
    }
    for (const [key, was, now] of changes) {
      console.log(`${was === undefined ? 'DODANO' : 'ZAKTUALIZOWANO'} npm run ${key} -> ${now}`);
    }
    console.log(`Kopia package.json: ${backup}`);
  } else {
    console.log('OK: wszystkie 8 skryptów jest już w package.json; bez zmian.');
  }
  const requiredFiles = [
    'scripts/dev-stack.cjs',
    'scripts/model-runtime.cjs',
    'scripts/model-runtime.test.cjs',
    'scripts/check-translations.cjs',
    'scripts/audit-style-budgets.cjs'
  ];
  const missing = requiredFiles.filter(p => !fs.existsSync(path.join(root, p)));
  if (missing.length) {
    console.warn('\nUWAGA: wpisy npm są przywrócone, ale brakuje plików wykonawczych:');
    for (const name of missing) console.warn(`  BawarJARVIS-/frontend/${name}`);
    console.warn('Nie uruchamiaj tych komend przed odzyskaniem brakujących plików.');
  } else {
    console.log('OK: pliki wykonawcze wymagane przez web/AI/i18n/audyt istnieją.');
  }
  if (!fs.existsSync(path.join(root, 'electron'))) {
    console.log('INFO: folder frontend/electron nie istnieje; polecenia Electron są opcjonalne i mogą nie działać.');
  }
}

try {
  main();
} catch (error) {
  console.error(`BŁĄD: ${error.message}`);
  process.exitCode = 1;
}
