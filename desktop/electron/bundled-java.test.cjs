'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { resolveBundledJava } = require('./bundled-java.cjs');
const { createBackendRuntime } = require('./backend-runtime.cjs');
const EventEmitter = require('node:events');

function fixture(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis17-java-'));
  try { return fn(dir); }
  finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
async function asyncFixture(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis17-java-'));
  try { return await fn(dir); }
  finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
function java(root) {
  const file = path.join(root, 'java', 'bin', 'java.exe');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, 'dummy');
  return file;
}

test('packaged Java resolves exclusively inside Electron resources', () => fixture(root => {
  const file = java(root);
  assert.equal(resolveBundledJava(root, fs, 'win32'), file);
}));

test('refuses missing runtime rather than using Java in PATH', () => fixture(root => {
  assert.throws(() => resolveBundledJava(root, fs, 'win32'), /Brak dołączonego/);
}));

test('refuses relative path and non-Windows packaging', () => fixture(root => {
  java(root);
  assert.throws(() => resolveBundledJava('relative', fs, 'win32'), /absolutnej/);
  assert.throws(() => resolveBundledJava(root, fs, 'linux'), /Windows/);
}));

test('refuses symlink executable (when OS permits creating symlinks)', t => fixture(root => {
  const actual = java(root);
  fs.unlinkSync(actual);
  try { fs.symlinkSync(path.join(root, 'other.exe'), actual, 'file'); }
  catch (error) {
    if (error.code === 'EPERM' || error.code === 'EACCES') { t.skip('Windows blocked symlink creation'); return; }
    throw error;
  }
  assert.throws(() => resolveBundledJava(root, fs, 'win32'), /dowiązanie/);
}));

test('explicit bundled Java binary is supplied to child spawn, never shell', async () => {
  await asyncFixture(async root => {
    const javaExe = java(root);
    const jarPath = path.join(root, 'jarvis-backend.jar');
    fs.writeFileSync(jarPath, 'jar');
    const envPath = path.join(root, 'backend.env');
    fs.writeFileSync(envPath, 'JARVIS_DB_PASSWORD=unit-test-password\n');
    const child = new EventEmitter();
    child.killed = false;
    child.kill = () => { child.killed = true; child.emit('exit', 0); return true; };
    let called;
    const runtime = createBackendRuntime({
      jarPath, javaBin: resolveBundledJava(root, fs, 'win32'),
      env: { APPDATA: root }, filePath: envPath,
      spawnImpl: (...args) => { called = args; return child; },
      fetchImpl: async url => ({ status: url.includes('/health') ? 0 : 200 }),
      sleepImpl: async () => {},
    });
    await runtime.start();
    assert.equal(called[0], javaExe);
    assert.equal(called[2].shell, false);
    assert.equal(called[2].cwd, root);
    runtime.stop();
    assert.equal(child.killed, true);
  });
});
