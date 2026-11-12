'use strict';
/**
 * J.A.R.V.I.S. web-first: set the EXISTING PostgreSQL role password to
 * backend/.env.jarvis, without dropping databases, tables, or Docker volumes.
 *
 * Install as: BawarJARVIS-/backend/scripts/repair-jarvis-db-auth.cjs
 * Usage: node scripts/repair-jarvis-db-auth.cjs --apply
 */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

function readDevSettings(file, inherited = process.env) {
  if (!fs.existsSync(file)) throw new Error('Brak backend/.env.jarvis');
  const names = ['HOST', 'PORT', 'NAME', 'USER', 'PASSWORD'].map(x => 'JARVIS_DB_' + x);
  if (names.some(name => Object.hasOwn(inherited, name))) {
    throw new Error('JARVIS_DB_* jest nadpisane w systemie: wyjasnij najpierw nadpisania.');
  }
  const springOverrides = ['SPRING_DATASOURCE_URL', 'SPRING_DATASOURCE_USERNAME',
    'SPRING_DATASOURCE_PASSWORD', 'SPRING_FLYWAY_URL', 'SPRING_FLYWAY_USER',
    'SPRING_FLYWAY_PASSWORD', 'SPRING_APPLICATION_JSON'];
  if (springOverrides.some(name => Object.hasOwn(inherited, name))) {
    throw new Error('SPRING_* nadpisuje konfiguracje bazy: wyjasnij najpierw nadpisania.');
  }
  const parsed = {};
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*(JARVIS_DB_(?:HOST|PORT|NAME|USER|PASSWORD))=(.*)\s*$/);
    if (!match) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    parsed[match[1]] = value;
  }
  for (const name of names) if (!parsed[name]) throw new Error(`Brak ${name} w backend/.env.jarvis`);
  if (parsed.JARVIS_DB_HOST !== '127.0.0.1' || parsed.JARVIS_DB_PORT !== '5433' ||
      parsed.JARVIS_DB_NAME !== 'jarvis_db' || parsed.JARVIS_DB_USER !== 'jarvis') {
    throw new Error('Nieoczekiwany cel. Nie modyfikuje nieznanej bazy.');
  }
  if (/[\r\n\0]/.test(parsed.JARVIS_DB_PASSWORD)) {
    throw new Error('Niebezpieczny znak w hasle. Nie wprowadzono zmian.');
  }
  return parsed;
}

function sqlPasswordLiteral(secret) {
  if (typeof secret !== 'string' || !secret || /[\r\n\0]/.test(secret)) {
    throw new Error('Niepoprawna wartosc hasla');
  }
  return "'" + secret.replace(/'/g, "''") + "'";
}

function exec(program, args, options = {}) {
  return spawnSync(program, args, {
    encoding: 'utf8', timeout: 30000, maxBuffer: 1024 * 1024,
    windowsHide: true, ...options
  });
}

function check(result, message) {
  if (result.error || result.status !== 0) {
    // Intentionally avoid reporting subprocess output; SQL errors might echo secrets.
    throw new Error(`${message} (exit ${result.status ?? 'brak'})`);
  }
  return (result.stdout || '').trim();
}

function main() {
  if (process.argv.length !== 3 || process.argv[2] !== '--apply') {
    console.log('Uzycie: node scripts/repair-jarvis-db-auth.cjs --apply');
    console.log('Zmienia haslo roli jarvis w istniejacym kontenerze; nie usuwa danych.');
    process.exitCode = 2;
    return;
  }
  const backend = path.resolve(__dirname, '..');
  const settings = readDevSettings(path.join(backend, '.env.jarvis'));
  const compose = (...args) => exec('docker', [
    'compose', '--env-file', '.env.jarvis', '-f', 'compose.db.yml', ...args
  ], { cwd: backend });

  const mapping = check(compose('port', 'jarvis-postgres', '5432'), 'Nie mozna odczytac mapowania Dockera');
  if (!mapping.split(/\r?\n/).some(line => line.trim() === '127.0.0.1:5433')) {
    throw new Error('Port Docker nie odpowiada 127.0.0.1:5433. Bez zmian.');
  }
  const identity = check(compose('exec', '-T', 'jarvis-postgres', 'psql',
    '-X', '-U', 'jarvis', '-d', 'jarvis_db', '-Atqc',
    'SELECT current_user, current_database()'), 'Nie mozna zweryfikowac kontenera');
  if (identity !== 'jarvis|jarvis_db') {
    throw new Error('Nieoczekiwana tozsamosc bazy. Bez zmian.');
  }

  console.log('TARGET_OK: Docker 127.0.0.1:5433 -> jarvis_db (jarvis)');
  console.log('Zmieniam wylacznie haslo istniejacej roli jarvis...');
  const sql = 'SET standard_conforming_strings = on;\n' +
    'ALTER ROLE "jarvis" WITH PASSWORD ' + sqlPasswordLiteral(settings.JARVIS_DB_PASSWORD) + ';\n';
  check(exec('docker', [
    'compose', '--env-file', '.env.jarvis', '-f', 'compose.db.yml',
    'exec', '-T', 'jarvis-postgres', 'psql', '-X', '-U', 'jarvis',
    '-d', 'jarvis_db', '-v', 'ON_ERROR_STOP=1', '-q'
  ], { cwd: backend, input: sql }), 'ALTER ROLE nie powiodlo sie');
  console.log('ROLE_PASSWORD_UPDATED: bez usuwania wolumenu, tabel i rozmow.');

  const jdbcProbe = path.join(backend, 'scripts', 'diagnose-jarvis-windows-jdbc.cjs');
  if (!fs.existsSync(jdbcProbe)) {
    console.log('BRAK TESTU JDBC: uruchom diagnose-jarvis-windows-jdbc.cjs recznie.');
    return;
  }
  const verified = exec(process.execPath, [jdbcProbe], { cwd: backend, timeout: 60000 });
  if (verified.status === 0 && /WINDOWS_JDBC_PASS/.test(verified.stdout || '')) {
    console.log('WINDOWS_JDBC_PASS: haslo dziala z Windows.');
  } else {
    const sqlState = (verified.stdout || '').match(/WINDOWS_JDBC_FAIL SQLSTATE=([A-Z0-9]+)/)?.[1];
    console.log(`WINDOWS_JDBC_NOT_VERIFIED${sqlState ? ' SQLSTATE=' + sqlState : ''}`);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  try { main(); }
  catch (error) { console.error('STOP:', error.message); process.exitCode = 1; }
}
module.exports = { readDevSettings, sqlPasswordLiteral };
