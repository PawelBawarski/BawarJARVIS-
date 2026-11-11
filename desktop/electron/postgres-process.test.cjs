'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const { runPgControl, isPostmasterDescendant } = require('./postgres-process.cjs');

const executable = path.resolve('fake-postgres-resources', 'pg_ctl.exe');
function fixture() {
  const child = new EventEmitter();
  child.killed = false;
  let kills = 0;
  let invocation = null;
  child.kill = () => { kills++; child.killed = true; return true; };
  return {
    child,
    spawnImpl: (...args) => { invocation = args; return child; },
    get invocation() { return invocation; },
    get kills() { return kills; },
  };
}

test('pg_ctl resolves on exit without close and uses isolated stdio without a shell', async () => {
  const f = fixture();
  const args = ['-D', path.resolve('fake-cluster'), 'status'];
  const env = { APPDATA: path.resolve('fake-appdata') };
  const pending = runPgControl(executable, args, { env, spawnImpl: f.spawnImpl });
  assert.deepEqual(f.invocation, [executable, args, {
    env, shell: false, windowsHide: true, stdio: 'ignore',
  }]);
  assert.equal(f.child.listenerCount('close'), 0);
  f.child.emit('exit', 0, null);
  assert.deepEqual(await pending, { stdout: '' });
  assert.equal(f.kills, 0);
});

test('pg_ctl preserves numeric exit 3 so callers can recognize a stopped cluster', async () => {
  const f = fixture();
  f.child.pid = 4567;
  const pending = runPgControl(executable, ['status'], { spawnImpl: f.spawnImpl });
  f.child.emit('exit', 3, null);
  await assert.rejects(pending, error => error.code === 3 && error.controllerPid === 4567 && !error.message.includes(executable));
  assert.equal(f.kills, 0);
});

test('pg_ctl spawn error preserves ENOENT without exposing native diagnostics', async () => {
  const f = fixture();
  const pending = runPgControl(executable, ['status'], { spawnImpl: f.spawnImpl });
  f.child.emit('error', Object.assign(new Error('private native diagnostic'), { code: 'ENOENT' }));
  await assert.rejects(pending, error => error.code === 'ENOENT' && !Object.hasOwn(error, 'controllerPid') && !error.message.includes('private'));
  assert.doesNotThrow(() => f.child.emit('error', new Error('late private diagnostic')));
});

test('pg_ctl sanitizes synchronous spawn failures', async () => {
  await assert.rejects(runPgControl(executable, [], {
    spawnImpl: () => { throw Object.assign(new Error('private spawn diagnostic'), { code: 'ENOENT' }); },
  }), error => error.code === 'ENOENT' && !error.message.includes('private'));
});

test('pg_ctl timeout kills only the direct child and rejects without waiting for exit or close', async () => {
  const f = fixture();
  f.child.pid = 8910;
  await assert.rejects(runPgControl(executable, ['start'], { spawnImpl: f.spawnImpl, timeout: 20 }),
    error => error.code === 'ETIMEDOUT' && error.controllerPid === 8910);
  assert.equal(f.kills, 1);
  assert.doesNotThrow(() => f.child.emit('error', new Error('late timeout diagnostic')));
  f.child.emit('exit', 1, null);
});

test('pg_ctl rejects an already aborted request without spawning a process', async () => {
  const f = fixture();
  const controller = new AbortController();
  controller.abort('private reason');
  await assert.rejects(runPgControl(executable, ['start'], { signal: controller.signal, spawnImpl: f.spawnImpl }),
    error => error.code === 'ABORT_ERR' && !error.message.includes('private'));
  assert.equal(f.invocation, null);
});

test('pg_ctl abort during execution kills the direct child once and handles late errors', async () => {
  const f = fixture();
  const controller = new AbortController();
  const pending = runPgControl(executable, ['start'], { signal: controller.signal, spawnImpl: f.spawnImpl });
  controller.abort('private reason');
  await assert.rejects(pending, error => error.code === 'ABORT_ERR' && !error.message.includes('private'));
  assert.equal(f.kills, 1);
  assert.doesNotThrow(() => f.child.emit('error', new Error('late abort diagnostic')));
  f.child.emit('exit', 0, null);
  assert.equal(f.kills, 1);
});

test('pg_ctl abort raised while spawning still cancels the spawned child', async () => {
  const f = fixture();
  const controller = new AbortController();
  const pending = runPgControl(executable, [], {
    signal: controller.signal,
    spawnImpl: (...args) => { controller.abort(); return f.spawnImpl(...args); },
  });
  await assert.rejects(pending, error => error.code === 'ABORT_ERR');
  assert.equal(f.kills, 1);
});

test('pg_ctl timeout remains bounded if sending kill throws', async () => {
  const f = fixture();
  f.child.kill = () => { throw new Error('private kill diagnostic'); };
  await assert.rejects(runPgControl(executable, [], { spawnImpl: f.spawnImpl, timeout: 20 }),
    error => error.code === 'ETIMEDOUT' && !error.message.includes('private'));
});

test('pg_ctl rejects invalid paths, arguments and unbounded timeouts before spawning', async () => {
  const f = fixture();
  for (const [file, args, timeout] of [
    ['relative.exe', [], 100],
    [executable, [3], 100],
    [executable, ['bad\0argument'], 100],
    [executable, [], Infinity],
    [executable, [], 0],
  ]) {
    await assert.rejects(runPgControl(file, args, { spawnImpl: f.spawnImpl, timeout }), TypeError);
  }
  assert.equal(f.invocation, null);
});

function ancestryFixture() {
  const attemptedAt = Date.now() - 2000;
  const createdAt = new Date(attemptedAt + 1000).toISOString();
  const info = {
    postgres: { pid: 4001, name: 'postgres.exe', parentPid: 3001, createdAt },
    parent: { pid: 3001, name: 'cmd.exe', parentPid: 2001, createdAt },
  };
  const env = { SystemRoot: path.resolve('fake-windows'), JARVIS_DB_PASSWORD: 'private-not-for-cim' };
  const options = { postmasterPid: 4001, controllerPid: 2001, attemptedAt, env, platform: 'win32' };
  return { info, options };
}

test('CIM verifies only postgres -> CMD -> this pg_ctl with trusted executable and fixed flags', async () => {
  const f = ancestryFixture();
  let invocation;
  assert.equal(await isPostmasterDescendant({ ...f.options,
    execImpl: async (...args) => { invocation = args; return { stdout: JSON.stringify(f.info) }; },
  }), true);
  assert.equal(invocation[0], path.join(f.options.env.SystemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'));
  assert.deepEqual(invocation[1].slice(0, 3), ['-NoProfile', '-NonInteractive', '-Command']);
  assert.match(invocation[1][3], /-Filter 'ProcessId = 4001'/);
  assert.doesNotMatch(invocation[1][3], /CommandLine|private-not-for-cim|JARVIS_DB_PASSWORD/);
  assert.equal(invocation[2].shell, false);
  assert.equal(invocation[2].windowsHide, true);
  assert.equal(invocation[2].timeout, 10000);
  assert.deepEqual(invocation[2].env, { SystemRoot: f.options.env.SystemRoot, WINDIR: f.options.env.SystemRoot });
});

test('CIM rejects invalid PID inputs, platform and Windows paths before executing', async () => {
  const f = ancestryFixture();
  let calls = 0;
  for (const changes of [
    { postmasterPid: '4001; arbitrary' }, { controllerPid: '2001' },
    { postmasterPid: 0 }, { controllerPid: -1 }, { controllerPid: 1.2 },
    { platform: 'linux' }, { env: { SystemRoot: 'relative' } },
    { env: {} }, { env: null }, { attemptedAt: Infinity },
  ]) {
    assert.equal(await isPostmasterDescendant({ ...f.options, ...changes,
      execImpl: async () => { calls++; return { stdout: JSON.stringify(f.info) }; },
    }), false);
  }
  assert.equal(calls, 0);
});

test('CIM rejects an unrelated parent, unexpected process names and stale or unknown timestamps', async () => {
  const f = ancestryFixture();
  for (const alter of [
    info => { info.postgres.pid++; },
    info => { info.postgres.parentPid++; },
    info => { info.parent.parentPid++; },
    info => { info.parent.name = 'other.exe'; },
    info => { info.postgres.name = 'other.exe'; },
    info => { info.postgres.createdAt = new Date(1).toISOString(); },
    info => { info.parent.createdAt = new Date(1).toISOString(); },
    info => { info.postgres.createdAt = 'unknown'; },
    info => { info.parent.createdAt = new Date(Date.now() + 60000).toISOString(); },
    info => { info.parent.createdAt = new Date(Date.parse(info.postgres.createdAt) + 100).toISOString(); },
  ]) {
    const info = structuredClone(f.info);
    alter(info);
    assert.equal(await isPostmasterDescendant({ ...f.options,
      execImpl: async () => ({ stdout: JSON.stringify(info) }),
    }), false);
  }
});

test('CIM fails closed for missing processes, malformed output or execution failure', async () => {
  const f = ancestryFixture();
  for (const stdout of ['null', '{}', 'false', 'true', '[]', 'not JSON', '', JSON.stringify({ postgres: null })]) {
    assert.equal(await isPostmasterDescendant({ ...f.options, execImpl: async () => ({ stdout }) }), false);
  }
  assert.equal(await isPostmasterDescendant({ ...f.options,
    execImpl: async () => { throw new Error('private native diagnostic'); },
  }), false);
});
