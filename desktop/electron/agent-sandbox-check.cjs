'use strict';
/** Stage 16.4: manual, syntax-only checks in offline Docker. Never executes proposed source. */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { validSourcePath } = require('./agent-proposal-ipc.cjs');

const NODE_IMAGE = 'node:22-alpine';
const JAVA_IMAGE = 'eclipse-temurin:21-jdk-alpine';
const MAX_CHARS = 8000;
const TIME_LIMIT_MS = 25000;
const MAX_OUTPUT = 12000;
const SUPPORTED = new Set(['.ts', '.tsx', '.js', '.cjs', '.json', '.java']);

function validate(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
      Object.keys(input).some(k => !['operation', 'relativePath', 'original', 'proposed'].includes(k)) ||
      input.operation !== 'check' || !validSourcePath(input.relativePath)) {
    throw new Error('INVALID_SANDBOX_REQUEST');
  }
  const ext = path.posix.extname(input.relativePath).toLowerCase();
  if (!SUPPORTED.has(ext)) throw new Error('UNSUPPORTED_SYNTAX_LANGUAGE');
  for (const value of [input.original, input.proposed]) {
    if (typeof value !== 'string' || !value.trim() || value.length > MAX_CHARS || value.includes('\0')) {
      throw new Error('INVALID_SNIPPET');
    }
  }
  if (input.original === input.proposed) throw new Error('NO_CODE_CHANGE');
  return { relativePath: input.relativePath, original: input.original, proposed: input.proposed, ext };
}

// This trusted runner ONLY asks the TypeScript parser to parse files. No eval, require, or import of snippet.
const PARSE_RUNNER = `
'use strict';
const fs = require('node:fs');
const ts = require('/tool/typescript.js');
const kind = process.argv[2];
function inspect(name) {
  const code = fs.readFileSync('/input/' + name, 'utf8');
  if (kind === '.json') {
    try { JSON.parse(code); return []; }
    catch (e) { return [String(e.message).slice(0, 300)]; }
  }
  const scriptKind = kind === '.tsx' ? ts.ScriptKind.TSX : kind === '.ts' ? ts.ScriptKind.TS : ts.ScriptKind.JS;
  const source = ts.createSourceFile(name, code, ts.ScriptTarget.Latest, true, scriptKind);
  return (source.parseDiagnostics || []).slice(0, 10).map(d =>
    ts.flattenDiagnosticMessageText(d.messageText, '\\n').slice(0, 300));
}
process.stdout.write(JSON.stringify({originalErrors:inspect('original.txt'), proposedErrors:inspect('proposed.txt')}));
`;

function safeDockerPath(p) {
  // Docker volume string must not accidentally include another bind specification.
  if (/[\r\n]/.test(p) || p.includes(':/opt/') || p.includes(':/input')) throw new Error('UNSAFE_DOCKER_PATH');
  return p;
}

function dockerArgs({ tmp, ext, tsCompiler, name, fileName }) {
  const args = [
    'run', '--rm', '--pull=never', '--name', name,
    '--network', 'none', '--read-only', '--cap-drop=ALL',
    '--security-opt', 'no-new-privileges', '--pids-limit', '48',
    '--memory', '384m', '--cpus', '1', '--user', '65534:65534',
    '--tmpfs', '/tmp:rw,nosuid,nodev,size=48m,mode=1777',
    '--volume', safeDockerPath(tmp) + ':/input:ro',
  ];
  if (ext === '.java') {
    return [...args, JAVA_IMAGE, 'javac', '-proc:none', '-d', '/tmp', '/input/' + fileName];
  }
  return [...args,
    '--volume', safeDockerPath(tsCompiler) + ':/tool/typescript.js:ro',
    NODE_IMAGE, 'node', '/input/runner.cjs', ext];
}

function execute(program, args, options = {}) {
  return new Promise(resolve => {
    const child = spawn(program, args, { windowsHide: true, shell: false });
    let stdout = '', stderr = '', ended = false, timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, options.timeout ?? TIME_LIMIT_MS);
    function collect(kind, chunk) {
      if (kind === 'out') stdout = (stdout + chunk.toString()).slice(0, MAX_OUTPUT);
      else stderr = (stderr + chunk.toString()).slice(0, MAX_OUTPUT);
      if (stdout.length >= MAX_OUTPUT || stderr.length >= MAX_OUTPUT) child.kill();
    }
    child.stdout?.on('data', c => collect('out', c));
    child.stderr?.on('data', c => collect('err', c));
    child.on('error', e => finish({ exitCode: -1, error: e.code || 'SPAWN_FAILED' }));
    child.on('close', code => finish({ exitCode: code ?? -1 }));
    function finish(other) {
      if (ended) return;
      ended = true;
      clearTimeout(timer);
      resolve({ stdout, stderr, timedOut, ...other });
    }
  });
}

function compilerPath(rootDir) {
  return path.resolve(rootDir, 'frontend/node_modules/typescript/lib/typescript.js');
}

function javacFileName(text) {
  const match = text.match(/\bpublic\s+(?:final\s+|abstract\s+|sealed\s+)?(?:class|interface|enum|record)\s+([A-Za-z_$][\w$]*)\b/);
  return match ? match[1] + '.java' : 'Snippet.java';
}

function isDockerUnavailable(output) {
  const text = `${output.stderr} ${output.error || ''}`;
  return /ENOENT|not found|No such image|Cannot connect|error during connect|docker daemon|docker engine|permission denied|pull access denied/i.test(text);
}

function showDiagnostics(text) {
  return text.trim().slice(0, 2000).replace(/\x1b\[[0-9;]*m/g, '');
}

let inFlight = false;
async function checkSandbox(input, deps = {}) {
  const request = validate(input);
  if (inFlight) return { status: 'unavailable', language: request.ext, message: 'Inna kontrola już trwa.' };
  inFlight = true;
  const run = deps.execute || execute;
  const rootDir = deps.rootDir || path.resolve(__dirname, '../..');
  let tmp = null;
  const name = 'jarvis-syntax-' + randomUUID().replaceAll('-', '').slice(0, 16);
  const orphanNames = [];
  try {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-syntax-'));
    fs.chmodSync(tmp, 0o755); // source fragments selected by user, NOT private project mounts
    const ext = request.ext;
    const tsCompiler = compilerPath(rootDir);
    if (ext !== '.java' && !fs.existsSync(tsCompiler)) {
      return { status: 'unavailable', language: ext, message: 'Brak frontend/node_modules/typescript. Wykonaj npm ci w frontend.' };
    }
    if (ext === '.java') {
      // Java compiler checks full class only. No other project classes or dependencies exist in the container.
      const fileName = javacFileName(request.proposed);
      const originalName = javacFileName(request.original);
      fs.mkdirSync(path.join(tmp, 'original'));
      fs.mkdirSync(path.join(tmp, 'proposed'));
      fs.writeFileSync(path.join(tmp, 'original', originalName), request.original, { mode: 0o644 });
      fs.writeFileSync(path.join(tmp, 'proposed', fileName), request.proposed, { mode: 0o644 });
      const base = dockerArgs({ tmp, ext, name: name + '-a', fileName: 'original/' + originalName });
      const prev = await run('docker', base);
      if (prev.timedOut) { orphanNames.push(name + '-a'); return { status: 'unavailable', language: ext, message: 'Limit czasu kompilatora Java.' }; }
      if (isDockerUnavailable(prev)) return { status: 'unavailable', language: ext, message: 'Brak lokalnego Docker Engine lub obrazu eclipse-temurin:21-jdk-alpine. Obraz nie jest pobierany automatycznie.' };
      const next = await run('docker', dockerArgs({ tmp, ext, name: name + '-b', fileName: 'proposed/' + fileName }));
      if (next.timedOut) { orphanNames.push(name + '-b'); return { status: 'unavailable', language: ext, message: 'Limit czasu kompilatora Java.' }; }
      if (isDockerUnavailable(next)) return { status: 'unavailable', language: ext, message: 'Docker/JDK niedostępny.' };
      if (prev.exitCode !== 0) {
        return { status: 'inconclusive', language: ext, message: 'Oryginalny fragment nie kompiluje się samodzielnie. Potrzebne zależności lub cały plik.', diagnostics: showDiagnostics(prev.stderr) };
      }
      const missingDependencies = /cannot find symbol|package .* does not exist|cannot access|does not exist|cannot be resolved/i.test(next.stderr);
      return { status: next.exitCode === 0 ? 'passed' : missingDependencies ? 'inconclusive' : 'failed', language: ext,
        message: next.exitCode === 0 ? 'javac -proc:none: proponowany fragment kompiluje się jako samodzielny plik.' : missingDependencies ? 'Brak kontekstu projektu lub zależności dla javac. Wynik niejednoznaczny.' : 'javac zgłosił błędy w proponowanym kodzie.',
        ...(next.exitCode ? { diagnostics: showDiagnostics(next.stderr) } : {}) };
    }
    fs.writeFileSync(path.join(tmp, 'original.txt'), request.original, { mode: 0o644 });
    fs.writeFileSync(path.join(tmp, 'proposed.txt'), request.proposed, { mode: 0o644 });
    fs.writeFileSync(path.join(tmp, 'runner.cjs'), PARSE_RUNNER, { mode: 0o644 });
    const result = await run('docker', dockerArgs({ tmp, ext, tsCompiler, name }));
    if (result.timedOut) { orphanNames.push(name); return { status: 'unavailable', language: ext, message: 'Limit czasu izolowanej kontroli.' }; }
    if (isDockerUnavailable(result)) return { status: 'unavailable', language: ext, message: 'Brak lokalnego Docker Engine lub obrazu node:22-alpine. Obraz nie jest pobierany automatycznie.' };
    if (result.exitCode !== 0) return { status: 'unavailable', language: ext, message: 'Kontrola Docker nie powiodła się.', diagnostics: showDiagnostics(result.stderr) };
    let parsed;
    try { parsed = JSON.parse(result.stdout); }
    catch { return { status: 'unavailable', language: ext, message: 'Niepoprawna odpowiedź izolowanego parsera.' }; }
    if (!Array.isArray(parsed.originalErrors) || !Array.isArray(parsed.proposedErrors)) {
      return { status: 'unavailable', language: ext, message: 'Nieznany format raportu parsera.' };
    }
    if (parsed.originalErrors.length) return { status: 'inconclusive', language: ext, message: 'Oryginalny fragment ma błędy składni lub jest niekompletny. Nie można wiarygodnie porównać zmiany.', diagnostics: parsed.originalErrors.slice(0, 5).join('\n') };
    if (parsed.proposedErrors.length) return { status: 'failed', language: ext, message: 'Parser wykrył błędy składni w propozycji.', diagnostics: parsed.proposedErrors.slice(0, 5).join('\n') };
    return { status: 'passed', language: ext, message: 'Składnia propozycji jest poprawna w izolowanym parserze. Nie wykonywano kodu ani testów projektu.' };
  } catch {
    return { status: 'unavailable', language: request.ext, message: 'Nie udało się uruchomić izolowanej kontroli.' };
  } finally {
    // Force-remove named containers if CLI timed out. Names are generated server-side.
    for (const orphan of orphanNames) {
      try { await execute('docker', ['rm', '-f', orphan], { timeout: 5000 }); } catch {}
    }
    if (tmp) { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {} }
    inFlight = false;
  }
}

function registerSandboxIpc(ipcMain, trustedSender, deps = {}) {
  ipcMain.handle('jarvis:agent-sandbox-check', async (event, input) => {
    if (!trustedSender(event)) throw new Error('Untrusted IPC sender');
    return checkSandbox(input, deps);
  });
}

module.exports = { validate, dockerArgs, checkSandbox, registerSandboxIpc, compilerPath, javacFileName, PARSE_RUNNER };
