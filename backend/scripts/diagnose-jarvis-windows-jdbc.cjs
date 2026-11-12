'use strict';
/**
 * J.A.R.V.I.S. 18.0 - Windows-side PostgreSQL JDBC verification.
 * Destination: BawarJARVIS-/backend/scripts/diagnose-jarvis-windows-jdbc.cjs
 * Read-only: no database mutations, no password output, no credentials files.
 */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const backend = path.resolve(__dirname, '..');
const localFile = path.join(backend, '.env.jarvis');

function loadSettings() {
  if (!fs.existsSync(localFile)) throw new Error('Brak backend/.env.jarvis');
  const parsed = {};
  const keys = ['HOST', 'PORT', 'NAME', 'USER', 'PASSWORD'];
  for (const line of fs.readFileSync(localFile, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*(JARVIS_DB_(?:HOST|PORT|NAME|USER|PASSWORD))=(.*)\s*$/);
    if (!match) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    parsed[match[1]] = value;
  }
  for (const key of keys) {
    const name = `JARVIS_DB_${key}`;
    if (Object.hasOwn(process.env, name)) parsed[name] = process.env[name];
  }
  for (const key of keys) {
    if (!parsed[`JARVIS_DB_${key}`]) throw new Error(`Brak JARVIS_DB_${key}`);
  }
  if (parsed.JARVIS_DB_HOST !== '127.0.0.1' ||
      !/^\d{2,5}$/.test(parsed.JARVIS_DB_PORT) ||
      !/^[a-zA-Z0-9_]+$/.test(parsed.JARVIS_DB_NAME) ||
      !/^[a-zA-Z0-9_]+$/.test(parsed.JARVIS_DB_USER)) {
    throw new Error('Niespodziewane parametry bazy - przerwano test');
  }
  return parsed;
}

function locateDriverJar() {
  const base = path.join(os.homedir(), '.m2', 'repository', 'org', 'postgresql', 'postgresql');
  if (!fs.existsSync(base)) throw new Error('Brak sterownika JDBC w ~/.m2/repository/org/postgresql/postgresql');
  const jars = fs.readdirSync(base, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => ({ version: d.name, file: path.join(base, d.name, `postgresql-${d.name}.jar`) }))
    .filter(d => fs.existsSync(d.file));
  if (!jars.length) throw new Error('Brak pobranego postgres JDBC .jar w Maven cache');
  jars.sort((a, b) => b.version.localeCompare(a.version, 'en', { numeric: true }));
  return jars[0];
}

const source = `
import java.sql.*;
public class JarvisJdbcPortProbe {
  public static void main(String[] args) throws Exception {
    String host = System.getenv("JARVIS_DB_HOST");
    String port = System.getenv("JARVIS_DB_PORT");
    String db = System.getenv("JARVIS_DB_NAME");
    String user = System.getenv("JARVIS_DB_USER");
    String password = System.getenv("JARVIS_DB_PASSWORD");
    Class.forName("org.postgresql.Driver");
    DriverManager.setLoginTimeout(8);
    String url = "jdbc:postgresql://" + host + ":" + port + "/" + db + "?connectTimeout=8";
    try (Connection connection = DriverManager.getConnection(url, user, password);
         Statement statement = connection.createStatement();
         ResultSet result = statement.executeQuery(
           "SELECT current_database(), current_user, inet_server_addr()::text, inet_server_port()")) {
      result.next();
      System.out.println("WINDOWS_JDBC_PASS");
      System.out.println("DB=" + result.getString(1) + "; USER=" + result.getString(2));
      System.out.println("SERVER_ADDR=" + result.getString(3) + "; SERVER_PORT=" + result.getInt(4));
    } catch (SQLException e) {
      System.out.println("WINDOWS_JDBC_FAIL SQLSTATE=" + e.getSQLState());
      System.exit(4);
    }
  }
}
`;

function run(program, args, options = {}) {
  return spawnSync(program, args, {
    cwd: backend, encoding: 'utf8', windowsHide: true, timeout: 30000,
    maxBuffer: 1024 * 1024, ...options
  });
}

let temp;
try {
  if (process.platform !== 'win32') throw new Error('Test jest przeznaczony do uruchomienia na Windows');
  const settings = loadSettings();
  const jar = locateDriverJar();
  console.log('=== WINDOWS JDBC PROBE ===');
  console.log(`TARGET=${settings.JARVIS_DB_HOST}:${settings.JARVIS_DB_PORT}/${settings.JARVIS_DB_NAME} (${settings.JARVIS_DB_USER})`);
  console.log(`JDBC_DRIVER_VERSION=${jar.version}`);
  for (const name of ['SPRING_DATASOURCE_URL', 'SPRING_DATASOURCE_USERNAME',
      'SPRING_DATASOURCE_PASSWORD', 'SPRING_FLYWAY_URL', 'SPRING_FLYWAY_PASSWORD',
      'SPRING_APPLICATION_JSON', 'JAVA_TOOL_OPTIONS', 'JDK_JAVA_OPTIONS']) {
    if (Object.hasOwn(process.env, name)) console.log(`ENV_OVERRIDE_PRESENT=${name}`);
  }
  console.log('=== WINDOWS PORT OWNERS ===');
  const netstat = run('netstat.exe', ['-ano']);
  if (!netstat.error && netstat.status === 0) {
    const lines = netstat.stdout.split(/\r?\n/)
      .filter(line => line.trim().split(/\s+/)[1]?.endsWith(':' + settings.JARVIS_DB_PORT));
    console.log(lines.length ? lines.slice(0, 10).map(s => s.trim()).join('\n') : 'NO_PORT_ENTRY');
  } else console.log('NETSTAT_UNAVAILABLE');
  console.log('=== DOCKER PUBLISHED PORT ===');
  const docker = run('docker', ['compose', '--env-file', '.env.jarvis', '-f', 'compose.db.yml', 'port', 'jarvis-postgres', '5432']);
  console.log(docker.status === 0 ? docker.stdout.trim() : 'DOCKER_PORT_UNAVAILABLE');
  temp = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-jdbc-probe-'));
  const file = path.join(temp, 'JarvisJdbcPortProbe.java');
  fs.writeFileSync(file, source, { encoding: 'utf8', flag: 'wx' });
  console.log('=== WINDOWS JAVA JDBC CONNECTION ===');
  const result = run('java', ['--class-path', jar.file, file], { env: { ...process.env, ...settings }, timeout: 45000 });
  if (result.stdout?.trim()) console.log(result.stdout.trim());
  if (result.error) console.log('JAVA_ERROR=' + result.error.code);
  if (result.stderr?.trim()) console.log('JAVA_STDERR=' + result.stderr.trim().slice(0, 800));
  if (result.status !== 0) process.exitCode = result.status || 1;
} catch (error) {
  console.error('STOP:', error.message);
  process.exitCode = 1;
} finally {
  if (temp) fs.rmSync(temp, { recursive: true, force: true });
}
