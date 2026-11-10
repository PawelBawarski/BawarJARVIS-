'use strict';
/** J.A.R.V.I.S. 16.5 — explicit, offline, Docker-only build/test of a disposable source copy.
 * NEVER writes to user-selected workspace; never runs a command from renderer or Qwen.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { createHash } = require('node:crypto'); // JARVIS_16_6_NATIVE_APPLY
const { WorkspaceAccess } = require('./workspace-access.cjs');
const { validSourcePath } = require('./agent-proposal-ipc.cjs');

const MAX_SOURCE_CHARS = 3600;
const MAX_PROPOSED_CHARS = 8000;
const MAX_FILES = 1800;
const MAX_TOTAL_BYTES = 32 * 1024 * 1024;
const MAX_SINGLE_FILE = 512 * 1024;
const MAX_LOG_BYTES = 16000;
const TIMEOUT_MS = 240000;
const IMAGES = Object.freeze({ frontend: 'jarvis-test-frontend:16.5', backend: 'jarvis-test-backend:16.5' });
const DECLARED = Object.freeze({
  frontend: ['Angular: build', 'Angular: Vitest'],
  backend: ['Java: Maven/JUnit'],
});
const DENY_DIRS = new Set([
  'node_modules', 'target', 'dist', 'build', '.git', '.angular', 'coverage',
  '.vscode', '.idea', '.ssh', '.aws', '.config', '.env', '__pycache__',
  'venv', '.venv', 'test-results', 'playwright-report', '.jarvis-stage16-5-backups',
]);
const SECRET_NAMES = /(?:^\.|(?:^|[._-])(?:secret|password|credential|token|api.?key|private|keystore|id_rsa|id_ed25519)(?:[._-]|$)|\.(?:env|pem|key|p12|pfx|jks|kdbx|db|sqlite|crt|cer)$)/i;
const CODE_EXT = new Set(['.ts', '.tsx', '.js', '.cjs', '.mjs', '.html', '.scss', '.css', '.json', '.svg', '.java', '.sql', '.xml', '.md', '.png', '.jpg', '.jpeg', '.gif', '.ico', '.woff', '.woff2', '.txt']);

function validateRequest(req) {
  if (!req || typeof req !== 'object' || Array.isArray(req) ||
      Object.keys(req).some(k => !['operation', 'relativePath', 'original', 'proposed'].includes(k)) ||
      req.operation !== 'test' || !validSourcePath(req.relativePath)) throw new Error('INVALID_TEST_REQUEST');
  const scope = req.relativePath.startsWith('frontend/src/') ? 'frontend'
    : req.relativePath.startsWith('backend/src/') ? 'backend' : null;
  if (!scope) throw new Error('TEST_PATH_NOT_IN_SOURCE_TREE');
  if (scope === 'frontend' && !/\.(?:ts|tsx|js|html|scss|css|json)$/i.test(req.relativePath)) throw new Error('UNSUPPORTED_FRONTEND_FORMAT');
  if (scope === 'backend' && !/\.java$/i.test(req.relativePath)) throw new Error('UNSUPPORTED_BACKEND_FORMAT');
  if (typeof req.original !== 'string' || !req.original.trim() || req.original.length > MAX_SOURCE_CHARS ||
      typeof req.proposed !== 'string' || !req.proposed.trim() || req.proposed.length > MAX_PROPOSED_CHARS ||
      req.original.includes('\0') || req.proposed.includes('\0') || req.original === req.proposed) {
    throw new Error('INVALID_TEST_SOURCE');
  }
  return { scope, relativePath: req.relativePath, original: req.original, proposed: req.proposed };
}
function uniqueReplacement(fileContent, original, proposed) {
  const first = fileContent.indexOf(original);
  if (first === -1) throw new Error('STALE_SOURCE: fragment nie pasuje do pliku na dysku. Odśwież podgląd.');
  if (fileContent.indexOf(original, first + original.length) !== -1) throw new Error('AMBIGUOUS_SOURCE: fragment występuje kilka razy.');
  return fileContent.slice(0, first) + proposed + fileContent.slice(first + original.length);
}
function shouldCopy(scope, relative) {
  const parts = relative.split('/');
  if (parts.some(p => !p || p === '..' || p.startsWith('.') || DENY_DIRS.has(p.toLowerCase()) || SECRET_NAMES.test(p))) return false;
  if (scope === 'frontend') {
    if (parts.length === 1) return /^(?:package(?:-lock)?\.json|angular\.json|tsconfig(?:\.[a-z0-9_-]+)?\.json)$/i.test(relative);
    if (!['src', 'public'].includes(parts[0])) return false;
    return CODE_EXT.has(path.extname(relative).toLowerCase());
  }
  if (scope === 'backend') {
    if (relative === 'pom.xml') return true;
    if (!relative.startsWith('src/')) return false;
    if (relative.startsWith('src/main/java/') || relative.startsWith('src/test/java/')) return relative.endsWith('.java');
    // Only Flyway migrations and non-sensitive test configuration, never production config.
    if (relative.startsWith('src/main/resources/db/migration/')) return relative.endsWith('.sql');
    if (relative === 'src/test/resources/application.properties') return true;
  }
  return false;
}
function checkTestProperties(bytes) {
  const content = bytes.toString('utf8');
  if (content.includes('\0')) throw new Error('SENSITIVE_TEST_CONFIGURATION');
  for (const raw of content.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || line.startsWith('!')) continue;
    const match = line.match(/^([^:=]+?)\s*[:=]\s*(.*?)\s*$/);
    if (!match) continue;
    const [, key, value] = match;
    if (/(?:password|secret|token|api[_-]?key|private[_-]?key|credential)/i.test(key) &&
        value && value !== '""' && value !== "''") {
      throw new Error('SENSITIVE_TEST_CONFIGURATION: wstrzymano kopiowanie konfiguracji.');
    }
    if (/jdbc:(?!h2:)/i.test(value)) throw new Error('SENSITIVE_TEST_CONFIGURATION: backend test must use H2 only.');
  }
}
function copyProjectScope(workspace, staging, scope, req) {
  const srcRoot = path.join(workspace, scope);
  if (!fs.statSync(srcRoot).isDirectory()) throw new Error('PROJECT_SCOPE_MISSING');
  const realRoot = fs.realpathSync(workspace);
  const finalFileRel = req.relativePath.slice(scope.length + 1);
  const state = { files: 0, bytes: 0, found: false };
  function traverse(relative = '') {
    const dir = path.join(srcRoot, relative);
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const rel = relative ? `${relative}/${entry.name}` : entry.name;
      const relParts = rel.split('/');
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        if (relParts.some(p => p.startsWith('.') || DENY_DIRS.has(p.toLowerCase()) || SECRET_NAMES.test(p))) continue;
        const accepted = scope === 'frontend' ? ['src','public'].includes(relParts[0])
          : relParts[0] === 'src';
        if (!accepted || relParts.length > 13) continue;
        traverse(rel);
        continue;
      }
      if (!entry.isFile() || !shouldCopy(scope, rel)) continue;
      const full = path.join(srcRoot, rel);
      // Verify the canonical path stays within the chosen workspace, including Windows junctions.
      const canonical = fs.realpathSync(full);
      if (!canonical.startsWith(realRoot + path.sep)) throw new Error('WORKSPACE_ESCAPE');
      const info = fs.lstatSync(full);
      if (!info.isFile() || info.size > MAX_SINGLE_FILE) {
        if (rel === finalFileRel) throw new Error('SOURCE_FILE_TOO_LARGE');
        continue;
      }
      state.files += 1;
      state.bytes += info.size;
      if (state.files > MAX_FILES || state.bytes > MAX_TOTAL_BYTES) throw new Error('PROJECT_COPY_LIMIT');
      let bytes = fs.readFileSync(full);
      if (rel === 'src/test/resources/application.properties') checkTestProperties(bytes);
      if (rel === finalFileRel) {
        let content;
        try { content = new TextDecoder('utf-8', {fatal: true}).decode(bytes); }
        catch { throw new Error('INVALID_SOURCE_UTF8'); }
        if (content.includes('\0')) throw new Error('BINARY_SOURCE');
        const modified = uniqueReplacement(content, req.original, req.proposed);
        bytes = Buffer.from(modified, 'utf8');
        state.found = true;
      }
      const destination = path.join(staging, scope, ...rel.split('/'));
      fs.mkdirSync(path.dirname(destination), { recursive: true, mode: 0o755 });
      fs.writeFileSync(destination, bytes, { mode: 0o644, flag: 'wx' });
    }
  }
  traverse();
  if (!state.found) throw new Error('SOURCE_NOT_COPIED: plik nie znajduje się na liście dozwolonej do testów.');
  const required = scope === 'frontend' ? 'frontend/package.json' : 'backend/pom.xml';
  if (!fs.existsSync(path.join(staging, required))) throw new Error('PROJECT_MANIFEST_MISSING');
  return state;
}
function dockerArgs(staging, scope, name) {
  if (/[:\r\n]/.test(staging.replace(/^[A-Za-z]:/, '')) && process.platform === 'win32') throw new Error('INVALID_DOCKER_MOUNT');
  if (/[\r\n,]/.test(staging)) throw new Error('INVALID_DOCKER_MOUNT');
  return [
    'run', '--rm', '--pull=never', '--name', name,
    '--network', 'none', '--read-only', '--cap-drop=ALL',
    '--security-opt', 'no-new-privileges', '--pids-limit', '128',
    '--cpus', '2', '--memory', scope === 'backend' ? '3g' : '2g', '--memory-swap', scope === 'backend' ? '3g' : '2g',
    '--user', '65534:65534', '--tmpfs', scope === 'backend'
      ? '/tmp:rw,nosuid,nodev,size=2048m,mode=1777'
      : '/tmp:rw,nosuid,nodev,size=1024m,mode=1777',
    '--mount', `type=bind,src=${staging},dst=/input,readonly`,
    '--env', 'HOME=/tmp', '--env', 'CI=true',
    IMAGES[scope], 'sh', '-c', scope === 'frontend' ? FRONTEND_RUN : BACKEND_RUN,
  ];
}
const FRONTEND_RUN = `set -eu
mkdir -p /tmp/project
cp -R /input/frontend /tmp/project/frontend
ln -s /opt/fe/node_modules /tmp/project/frontend/node_modules
cd /tmp/project/frontend
printf '\\n[JARVIS] ANGULAR_BUILD_START\\n'
if /opt/fe/node_modules/.bin/ng build; then
  printf '\\n[JARVIS] ANGULAR_BUILD_OK\\n'
else
  printf '\\n[JARVIS] ANGULAR_BUILD_FAILED\\n'; exit 11
fi
printf '\\n[JARVIS] ANGULAR_TEST_START\\n'
if /opt/fe/node_modules/.bin/ng test --watch=false; then
  printf '\\n[JARVIS] ANGULAR_TEST_OK\\n'
else
  printf '\\n[JARVIS] ANGULAR_TEST_FAILED\\n'; exit 12
fi`;
const BACKEND_RUN = `set -eu
mkdir -p /tmp/project /tmp/m2
cp -R /input/backend /tmp/project/backend
cp -R /opt/m2/. /tmp/m2/ 2>/dev/null || true
cd /tmp/project/backend
printf '\\n[JARVIS] MAVEN_TEST_START\\n'
if mvn -B -o -Dmaven.repo.local=/tmp/m2 test; then
  printf '\\n[JARVIS] MAVEN_TEST_OK\\n'
else
  printf '\\n[JARVIS] MAVEN_TEST_FAILED\\n'; exit 13
fi`;
function spawnDocker(args, timeout = TIMEOUT_MS) {
  return new Promise(resolve => {
    const child = spawn('docker', args, { shell: false, windowsHide: true });
    let stdout = '', stderr = '', ended = false, timedOut = false, truncated = false;
    const timer = setTimeout(() => { timedOut = true; child.kill(); }, timeout);
    function append(which, chunk) {
      const text = chunk.toString('utf8');
      if (which === 'stdout') { if (stdout.length + text.length > MAX_LOG_BYTES) truncated = true; stdout = (stdout + text).slice(-MAX_LOG_BYTES); }
      else { if (stderr.length + text.length > MAX_LOG_BYTES) truncated = true; stderr = (stderr + text).slice(-MAX_LOG_BYTES); }
    }
    child.stdout?.on('data', d => append('stdout', d));
    child.stderr?.on('data', d => append('stderr', d));
    child.on('error', err => finish(-1, err.code || 'DOCKER_SPAWN_ERROR'));
    child.on('close', code => finish(code ?? -1));
    function finish(exitCode, error) { if (ended) return; ended = true; clearTimeout(timer); resolve({ exitCode, stdout, stderr, timedOut, truncated, error }); }
  });
}
function redactOutput(out) {
  return out.replace(/\x1b\[[0-9;]*m/g,'').replace(/(?:password|secret|token|api[_-]?key)\s*[:=]\s*\S+/gi,'[REDACTED]')
    .slice(-MAX_LOG_BYTES);
}
function parseReport(output, scope) {
  if (output.timedOut) return {status:'unavailable', scope, message:'Przekroczono czas testów kontenera.', diagnostics:redactOutput(output.stderr)};
  const error = `${output.error || ''} ${output.stderr || ''}`;
  if (/ENOENT|Cannot connect|daemon|error during connect|No such image|pull access denied|permission denied/i.test(error)) {
    return {status:'unavailable', scope, message:`Docker lub obraz ${IMAGES[scope]} niedostępny. Przygotuj obraz testowy ręcznie.`, diagnostics:redactOutput(error)};
  }
  const all = `${output.stdout || ''}\n${output.stderr || ''}`;
  if (output.exitCode === 0 && (scope === 'frontend'
    ? all.includes('[JARVIS] ANGULAR_TEST_OK')
    : all.includes('[JARVIS] MAVEN_TEST_OK'))) {
    return {status:'passed', scope, message:scope === 'frontend' ? 'ng build i ng test zakończone pomyślnie w izolowanej kopii.' : 'mvn test zakończone pomyślnie w izolowanej kopii.', diagnostics:redactOutput(all)};
  }
  if (output.exitCode === 0) return {status:'inconclusive',scope,message:'Kontener zakończył się bez potwierdzenia etapów testowych.', diagnostics:redactOutput(all)};
  if (/Could not resolve|offline mode|missing.*artifact|MODULE_NOT_FOUND|Cannot find module|No such file or directory|Unknown host|not in offline mode/i.test(all)) {
    return {status:'unavailable',scope,message:'Brak zależności w przygotowanym obrazie testowym; wyniku nie traktuj jako błędu zmiany.', diagnostics:redactOutput(all)};
  }
  return {status:'failed', scope, message:'Build lub testy nie przeszły w izolowanej kopii. Sprawdź diagnostykę.', diagnostics:redactOutput(all)};
}
let occupied = false;
async function runProjectTest(input, deps = {}) {
  const req = validateRequest(input);
  if (occupied) return { status:'unavailable', scope:req.scope, message:'Inne testowanie już trwa.' };
  occupied = true;
  let tmp = null;
  let containerName = null;
  try {
    const access = deps.access || new WorkspaceAccess(deps.userDataDir);
    const workspace = access.root();
    if (!workspace) throw new Error('WORKSPACE_NOT_SELECTED');
    // Keep path validation of the existing read-only workspace bridge.
    const originalSourceFile = access.resolve(req.relativePath, false);
    const originalFingerprint = createHash('sha256').update(fs.readFileSync(originalSourceFile)).digest('hex');
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-project-test-'));
    fs.chmodSync(tmp, 0o755);
    const copied = copyProjectScope(workspace, tmp, req.scope, req);
    containerName = `jarvis-proj-${randomUUID().replaceAll('-','').slice(0,16)}`;
    const result = await (deps.execute || spawnDocker)(dockerArgs(tmp, req.scope, containerName));
    const parsed = parseReport(result, req.scope);
    if (parsed.status === 'passed') {
      const currentSourceFile = access.resolve(req.relativePath, false);
      const afterFingerprint = createHash('sha256').update(fs.readFileSync(currentSourceFile)).digest('hex');
      if (originalFingerprint !== afterFingerprint) {
        return { status:'inconclusive', scope:req.scope, message:'Plik zmienił się podczas testów; ponów test.', copiedFiles:copied.files };
      }
    }
    return { ...parsed, copiedFiles:copied.files,
      ...(parsed.status === 'passed' ? { sourceSha256: originalFingerprint } : {}) };
  } catch (err) {
    return {status:'unavailable', scope:req.scope, message: err instanceof Error ? err.message : 'Nie udało się przygotować kopii projektu.'};
  } finally {
    // A timeout must not leave a background container with untrusted code running.
    if (containerName) { try { await (deps.cleanup || spawnDocker)(['rm','-f',containerName], 10000); } catch {} }
    if (tmp) { try { fs.rmSync(tmp,{recursive:true,force:true}); } catch {} }
    occupied = false;
  }
}
function registerProjectTestIpc(ipcMain, trustedSender, config) {
  const access = new WorkspaceAccess(config.userDataDir);
  ipcMain.handle('jarvis:agent-project-test', async (event, request) => {
    if (!trustedSender(event)) throw new Error('UNTRUSTED_IPC_SENDER');
    const tested = await runProjectTest(request, {access});
    const { sourceSha256, ...publicReport } = tested;
    if (tested.status === 'passed' && sourceSha256 && typeof config.onPassed === 'function') {
      try { return { ...publicReport, grantId: config.onPassed(request, sourceSha256) }; }
      catch { return { ...publicReport, status:'inconclusive', message:'Wynik testu nie został powiązany z aktualnym plikiem; ponów test.' }; }
    }
    return publicReport;
  });
}
module.exports = { validateRequest, uniqueReplacement, shouldCopy, copyProjectScope, dockerArgs, parseReport,
  runProjectTest, registerProjectTestIpc, IMAGES, FRONTEND_RUN, BACKEND_RUN };
