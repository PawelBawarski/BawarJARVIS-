'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { validate, dockerArgs, checkSandbox, registerSandboxIpc } = require('./agent-sandbox-check.cjs');

const request = { operation: 'check', relativePath: 'frontend/src/app/sample.ts', original: 'const x = 1;', proposed: 'const x = 2;' };
const fakeCompilerRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-test-tool-'));
fs.mkdirSync(path.join(fakeCompilerRoot, 'frontend/node_modules/typescript/lib'), { recursive: true });
fs.writeFileSync(path.join(fakeCompilerRoot, 'frontend/node_modules/typescript/lib/typescript.js'), 'module.exports = {};');

// No Docker is used by these unit tests. Docker calls are mocked and arguments inspected.
test('rejects traversal, hidden/secrets paths, extra operation and unsupported file types', () => {
  for (const change of [
    { relativePath: '../password.ts' }, { relativePath: '.env' },
    { relativePath: 'frontend/secret-token.ts' }, { relativePath: 'src/app.cmd' },
    { operation: 'apply' }, { proposed: '' }, { proposed: request.original },
  ]) assert.throws(() => validate({ ...request, ...change }));
});

test('Docker always disables network and code execution is not used for TS', () => {
  const args = dockerArgs({ tmp: '/tmp/test', tsCompiler: '/opt/ts/typescript.js', ext: '.ts', name: 'jarvis-syntax-test' });
  assert.ok(args.includes('--network'));
  assert.equal(args[args.indexOf('--network') + 1], 'none');
  assert.ok(args.includes('--read-only'));
  assert.ok(args.includes('--cap-drop=ALL'));
  assert.ok(args.includes('no-new-privileges'));
  assert.ok(args.includes('--pull=never'));
  assert.equal(args[args.length - 3], 'node');
  assert.equal(args[args.length - 2], '/input/runner.cjs');
  assert.ok(!args.some(s => s.includes('C:/Users/bawar/Desktop/Nauka/BawarJARVIS-')));
});

test('reports syntax pass without executing source', async () => {
  const calls = [];
  const result = await checkSandbox(request, { rootDir: fakeCompilerRoot, execute: async (cmd, args) => {
    calls.push([cmd, args]);
    assert.equal(cmd, 'docker');
    return { exitCode: 0, stderr: '', stdout: JSON.stringify({ originalErrors: [], proposedErrors: [] }) };
  } });
  assert.equal(result.status, 'passed');
  assert.equal(calls.length, 1);
});

test('syntax errors cause failure but do not execute generated code', async () => {
  const result = await checkSandbox(request, { rootDir: fakeCompilerRoot, execute: async () => ({
    exitCode: 0, stderr: '', stdout: JSON.stringify({ originalErrors: [], proposedErrors: ['Expected ;'] }),
  }) });
  assert.equal(result.status, 'failed');
  assert.match(result.diagnostics, /Expected/);
});

test('incomplete original snippet yields inconclusive (not false pass)', async () => {
  const result = await checkSandbox(request, { rootDir: fakeCompilerRoot, execute: async () => ({
    exitCode: 0, stderr: '', stdout: JSON.stringify({ originalErrors: ['} expected'], proposedErrors: [] }),
  }) });
  assert.equal(result.status, 'inconclusive');
});

test('missing Docker image reports unavailable and never pulls', async () => {
  const result = await checkSandbox(request, { rootDir: fakeCompilerRoot, execute: async (cmd,args) => {
    assert.ok(args.includes('--pull=never'));
    return { exitCode: 125, stdout: '', stderr: 'No such image: node:22-alpine' };
  } });
  assert.equal(result.status, 'unavailable');
});

test('trusted Electron sender is required before sandbox is invoked', async () => {
  let callback;
  registerSandboxIpc({ handle: (channel, fn) => { assert.equal(channel, 'jarvis:agent-sandbox-check'); callback = fn; } },
    () => false, { rootDir: fakeCompilerRoot });
  await assert.rejects(callback({}, request), /Untrusted/);
});

test('Java preview requires no external project access', async () => {
  const req = { operation:'check', relativePath:'backend/src/main/java/Test.java',
    original:'class Test {}', proposed:'class Test { int x = 1; }' };
  const all = [];
  const result = await checkSandbox(req, {rootDir: fakeCompilerRoot, execute: async (_cmd,args) => {
    all.push(args);
    return { exitCode:0,stdout:'',stderr:'' };
  }});
  assert.equal(result.status, 'passed');
  assert.equal(all.length, 2);
  assert.ok(all.every(args => args.includes('-proc:none') && args.includes('--network')));
});

test('ambiguous Java import errors cannot be treated as a valid compilation', async () => {
  const req = { operation:'check', relativePath:'backend/src/main/java/Test.java',
    original:'class Test {}', proposed:'class Test { int x = 1; }' };
  const result = await checkSandbox(req, { rootDir:fakeCompilerRoot, execute: async () => ({exitCode:1,stdout:'',stderr:'cannot find symbol'}) });
  assert.equal(result.status, 'inconclusive');
});

test('Java missing project dependency is inconclusive, not a false failure', async () => {
  const req = { operation:'check', relativePath:'backend/src/main/java/Test.java',
    original:'class Test {}', proposed:'class Test { OtherService service; }' };
  let count = 0;
  const result = await checkSandbox(req, { rootDir:fakeCompilerRoot, execute: async () => {
    count++;
    return count === 1 ? { exitCode:0, stdout:'', stderr:'' } :
      { exitCode:1, stdout:'', stderr:'error: cannot find symbol: class OtherService' };
  }});
  assert.equal(result.status, 'inconclusive');
});

test.after(() => fs.rmSync(fakeCompilerRoot, { recursive: true, force: true }));
