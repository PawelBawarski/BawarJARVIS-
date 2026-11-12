'use strict';
/**
 * J.A.R.V.I.S. web-first: check the EXACT Docker PostgreSQL TCP credentials
 * used by the local dev stack. Optional --repair changes only the jarvis role
 * password in the existing Docker database; it never deletes data/volumes.
 *
 * Place at: BawarJARVIS-/backend/scripts/diagnose-jarvis-db-auth.cjs
 */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const backend = path.resolve(__dirname, '..');
const envFile = path.join(backend, '.env.jarvis');
const repair = process.argv.includes('--repair');
const keys = [
  'JARVIS_DB_HOST', 'JARVIS_DB_PORT', 'JARVIS_DB_NAME',
  'JARVIS_DB_USER', 'JARVIS_DB_PASSWORD'
];

function localSettings() {
  if (!fs.existsSync(envFile)) throw new Error('Brak backend/.env.jarvis');
  const values = {};
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*(JARVIS_DB_(?:HOST|PORT|NAME|USER|PASSWORD))=(.*)\s*$/);
    if (!match) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values[match[1]] = value;
  }
  for (const key of keys) {
    if (Object.hasOwn(process.env, key)) values[key] = process.env[key];
  }
  return values;
}

function compose(args, input) {
  return spawnSync('docker', [
    'compose', '--env-file', '.env.jarvis', '-f', 'compose.db.yml',
    ...args
  ], {
    cwd: backend,
    encoding: 'utf8',
    windowsHide: true,
    input,
    maxBuffer: 2 * 1024 * 1024,
    timeout: 30000
  });
}

function ensureSuccess(result, label) {
  if (result.error || result.status !== 0) {
    const hint = (result.stderr || '').trim().slice(0, 600);
    throw new Error(`${label} (exit ${result.status ?? 'brak'}): ${hint || result.error?.message || 'brak szczegolow'}`);
  }
  return (result.stdout || '').trim();
}

// Send the password only over stdin to a process inside the container.
// Never put it into shell command arguments, terminal history or logs.
function tcpAuthentication(password) {
  return compose([
    'exec', '-T', 'jarvis-postgres', 'sh', '-c',
    'IFS= read -r PGPASSWORD || exit 5; export PGPASSWORD; ' +
    'exec psql -X -h 127.0.0.1 -U "$POSTGRES_USER" ' +
    '-d "$POSTGRES_DB" -Atqc "SELECT 1"'
  ], `${password}\n`);
}

try {
  const settings = localSettings();
  const dbOverrides = keys.filter(key => Object.hasOwn(process.env, key));
  console.log('=== EFEKTYWNE ZRODLA KONFIGURACJI ===');
  for (const key of keys) {
    console.log(`${key}: ${Object.hasOwn(process.env, key) ? 'ZMIENNA_SYSTEMOWA' : 'PLIK_ENV'}`);
  }
  if (repair && dbOverrides.length) {
    throw new Error('Wykryto systemowe JARVIS_DB_*. Przed naprawa usun nadpisania w tej sesji lub ustal ich pochodzenie.');
  }
  const springOverrides = [
    'SPRING_DATASOURCE_PASSWORD', 'SPRING_DATASOURCE_URL',
    'SPRING_DATASOURCE_USERNAME', 'SPRING_FLYWAY_PASSWORD',
    'SPRING_FLYWAY_URL', 'SPRING_FLYWAY_USER', 'SPRING_APPLICATION_JSON'
  ].filter(key => Object.hasOwn(process.env, key));
  if (springOverrides.length) {
    console.log('UWAGA: SPRING_OVERRIDE_SET:', springOverrides.join(', '));
    if (repair) throw new Error('Najpierw wyjasnij nadpisania konfiguracji Spring.');
  }
  const host = settings.JARVIS_DB_HOST || '127.0.0.1';
  const port = settings.JARVIS_DB_PORT || '5433';
  const db = settings.JARVIS_DB_NAME || 'jarvis_db';
  const user = settings.JARVIS_DB_USER || 'jarvis';
  const password = settings.JARVIS_DB_PASSWORD;
  if (host !== '127.0.0.1' || !/^\d{2,5}$/.test(port)) {
    throw new Error('Nieoczekiwany host/port. Sprawdz backend/.env.jarvis.');
  }
  if (!/^[a-z][a-z0-9_]*$/.test(db) || !/^[a-z][a-z0-9_]*$/.test(user)) {
    throw new Error('Nieoczekiwana nazwa bazy lub roli.');
  }
  if (!password || /[\r\n\0]/.test(password)) {
    throw new Error('Brak lub niedozwolona postac JARVIS_DB_PASSWORD.');
  }
  console.log('=== CEL POLACZENIA ===');
  console.log(`Spring -> ${host}:${port}/${db} (${user})`);
  const published = ensureSuccess(
    compose(['port', 'jarvis-postgres', '5432']),
    'Nie mozna ustalic portu kontenera'
  );
  console.log('Docker published port:', published);
  if (!published.split(/\r?\n/).some(line => line.trim() === `127.0.0.1:${port}`)) {
    throw new Error('Port kontenera NIE odpowiada konfiguracji Spring Boot. Nie modyfikuj hasla.');
  }
  const identity = ensureSuccess(compose([
    'exec', '-T', 'jarvis-postgres', 'sh', '-c',
    'printf "%s\\n%s\\n" "$POSTGRES_USER" "$POSTGRES_DB"'
  ]), 'Brak dostepu do dzialajacego kontenera');
  const [containerUser, containerDb] = identity.split(/\r?\n/);
  if (user !== containerUser || db !== containerDb) {
    throw new Error('Uzytkownik/baza kontenera nie odpowiada konfiguracji aplikacji.');
  }
  console.log('Docker container identity: PASS');

  console.log('=== TEST HASLA PO TCP ===');
  const before = tcpAuthentication(password);
  if (!before.error && before.status === 0 && before.stdout.trim() === '1') {
    console.log('TCP_AUTH_PASS: Haslo dziala. Nie trzeba go zmieniac.');
    if (springOverrides.length) console.log('Sprawdz nadpisania zmiennych SPRING_* powyzej.');
    else console.log('Jesli Spring nadal zwraca 28P01, sprawdz czy port 5433 trafia do tego kontenera.');
    process.exit(0);
  }
  console.log('TCP_AUTH_FAILED: haslo z dev-stack nie dziala w tym kontenerze.');
  if (!repair) {
    console.log('Aby zsynchronizowac haslo bez usuwania danych:');
    console.log('node scripts/diagnose-jarvis-db-auth.cjs --repair');
    process.exitCode = 2;
  } else {
    // Connect through the local Unix socket as the cluster's initial superuser.
    // This is intentionally different from the TCP check above.
    const local = compose([
      'exec', '-T', 'jarvis-postgres', 'psql', '-X', '-U', user,
      '-d', db, '-Atqc', 'SELECT 1'
    ]);
    if (local.error || local.status !== 0 || local.stdout.trim() !== '1') {
      throw new Error('Nie mozna bezpiecznie uwierzytelnic sie lokalnie w kontenerze. Bez zmian.');
    }
    const escaped = password.replace(/'/g, "''");
    const statement = `SET standard_conforming_strings = on;\nALTER ROLE "${user}" WITH PASSWORD '${escaped}';\n`;
    const changed = compose([
      'exec', '-T', 'jarvis-postgres', 'psql', '-X', '-U', user,
      '-d', db, '-v', 'ON_ERROR_STOP=1', '-q'
    ], statement);
    if (changed.error || changed.status !== 0) {
      throw new Error('Zmiana hasla nie powiodla sie (bez wypisywania zapytania z sekretem).');
    }
    const after = tcpAuthentication(password);
    if (after.error || after.status !== 0 || after.stdout.trim() !== '1') {
      throw new Error('Zmiana zostala wykonana, ale test TCP nadal nie przechodzi.');
    }
    console.log('REPAIR_PASS: TCP uwierzytelnia haslo zgodne z dev-stack.');
    console.log('Nie usunieto ani nie odtworzono danych/volumenu PostgreSQL.');
  }
} catch (error) {
  console.error('STOP:', error.message);
  process.exitCode = 1;
}
