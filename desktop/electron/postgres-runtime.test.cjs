'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { locations, createPostgresRuntime, createDatabaseLifecycle } = require('./postgres-runtime.cjs');

function fixture() {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-pg17-'));
  const home = path.join(folder, 'resources');
  const app = path.join(folder, 'JarvisData');
  const state = path.join(app, 'postgres17');
  const data = path.join(state, 'data');
  fs.mkdirSync(path.join(home, 'postgres', 'bin'), { recursive: true });
  fs.mkdirSync(data, { recursive: true });
  fs.writeFileSync(path.join(home, 'postgres', 'bin', 'pg_ctl.exe'), 'stub');
  fs.writeFileSync(path.join(data, 'PG_VERSION'), '17\n');
  const status = { schema: 'jarvis.postgres17.v1', major: 17, port: 55432,
    database: 'jarvis_db', activated: true, migrated: true };
  fs.writeFileSync(path.join(state, 'state.json'), JSON.stringify(status));
  const envtext = 'JARVIS_DB_HOST=127.0.0.1\nJARVIS_DB_PORT=55432\nJARVIS_DB_NAME=jarvis_db\nJARVIS_DB_USER=jarvis\nJARVIS_DB_PASSWORD=secret\n';
  fs.writeFileSync(path.join(app, 'backend.env'), envtext);
  return { folder, home, state, data, status, envtext, env: { APPDATA: folder },
    cleanup() { fs.rmSync(folder, { recursive: true, force: true }); } };
}
test('only packaged loopback PostgreSQL 17 with activated migration can start', () => {
  const f = fixture();
  try {
    const found = locations(f.home, f.env, fs, 'win32');
    assert.equal(found.dataDir, f.data);
    assert.throws(() => locations(f.home, f.env, fs, 'linux'), /Windows/);
    assert.throws(() => locations(f.home, { ...f.env, JARVIS_DB_PORT: '5433' }, fs, 'win32'), /Konflikt/);
    fs.writeFileSync(path.join(f.state, 'state.json'), JSON.stringify({ ...f.status, activated: false }));
    assert.throws(() => locations(f.home, f.env, fs, 'win32'), /aktywowana/);
  } finally { f.cleanup(); }
});
test('runtime executes only pg_ctl for managed cluster, and shuts down owned server', async () => {
  const f = fixture();
  const cmds = [];
  let online = false;
  const exec = async (executable, args, opts) => {
    cmds.push({ executable, args, opts });
    if (args.at(-1) === 'status') {
      if (!online) throw Object.assign(new Error('not running'), { code: 3 });
      return { stdout: '' };
    }
    if (args.at(-1) === 'start') online = true;
    if (args.at(-1) === 'stop') online = false;
    return { stdout: '' };
  };
  try {
    const pg = createPostgresRuntime({ resourcesPath: f.home, env: f.env, platform: 'win32', execImpl: exec });
    assert.deepEqual(await pg.start(), { started: true, owned: true });
    await pg.stop();
    assert.equal(online, false);
    assert.deepEqual(cmds.map(c => c.args.at(-1)), ['status', 'start', 'stop']);
    assert(cmds.every(c => c.executable.endsWith('pg_ctl.exe') && c.opts.shell === false));
    assert(cmds.every(c => !c.opts.env.PGPASSWORD));
  } finally { f.cleanup(); }
});
test('runtime does not stop a PostgreSQL cluster already running when app opens', async () => {
  const f = fixture();
  const cmds = [];
  try {
    const pg = createPostgresRuntime({ resourcesPath: f.home, env: f.env,
      platform: 'win32', execImpl: async (_exe, args) => { cmds.push(args.at(-1)); return {}; } });
    assert.deepEqual(await pg.start(), { started: true, owned: false });
    await pg.stop();
    assert.deepEqual(cmds, ['status']);
  } finally { f.cleanup(); }
});
test('wrong PostgreSQL major is blocked', () => {
  const f = fixture();
  try {
    fs.writeFileSync(path.join(f.data, 'PG_VERSION'), '18');
    assert.throws(() => locations(f.home, f.env, fs, 'win32'), /PostgreSQL 17/);
  } finally { f.cleanup(); }
});
test('symlinked PostgreSQL executable is blocked', (t) => {
  const f = fixture();
  try {
    fs.renameSync(path.join(f.home, 'postgres', 'bin', 'pg_ctl.exe'), path.join(f.home, 'postgres', 'bin', 'real.exe'));
    try {
      fs.symlinkSync('real.exe', path.join(f.home, 'postgres', 'bin', 'pg_ctl.exe'));
    } catch (e) {
      if (['EPERM','EACCES'].includes(e.code)) return t.skip('Windows nie pozwala utworzyć symlinka testowego');
      throw e;
    }
    assert.throws(() => locations(f.home, f.env, fs, 'win32'), /symlink/);
  } finally { f.cleanup(); }
});

test('Windows junctions cannot redirect the PostgreSQL data directory', () => {
  const f = fixture();
  try {
    const outside = path.join(f.folder, 'outside');
    fs.renameSync(f.data, outside);
    fs.symlinkSync(outside, f.data, process.platform === 'win32' ? 'junction' : 'dir');
    assert.throws(() => locations(f.home, f.env, fs, 'win32'), /symlink/);
  } finally { f.cleanup(); }
});

test('failed start cleans up only a new postmaster for this exact cluster', async () => {
  const f = fixture();
  const calls = [];
  let online = false;
  try {
    const pg = createPostgresRuntime({ resourcesPath: f.home, env: f.env, platform: 'win32',
      ownershipImpl: async () => true,
      execImpl: async (_exe, args) => {
        calls.push(args.at(-1));
        if (args.at(-1) === 'status' && !online) throw Object.assign(Error('offline'), { code: 3 });
        if (args.at(-1) === 'start') {
          online = true;
          fs.writeFileSync(path.join(f.data, 'postmaster.pid'),
            `12345\n${f.data}\n${Math.floor(Date.now()/1000)}\n55432\n\n127.0.0.1\n\nready\n`);
          throw Object.assign(Error('private diagnostic'), { controllerPid: 333 });
        }
        if (args.at(-1) === 'stop') online = false;
      },
    });
    await assert.rejects(pg.start(), error => {
      assert.doesNotMatch(error.message, /private diagnostic/);
      return /Nie udało się uruchomić/.test(error.message);
    });
    assert.deepEqual(calls, ['status', 'start', 'status', 'stop']);
    assert.equal(online, false);
    assert.equal(fs.existsSync(path.join(f.data, 'PG_VERSION')), true);
  } finally { f.cleanup(); }
});

test('shutdown waits for pending start and stops the newly owned server exactly once', async () => {
  const f = fixture();
  let releaseStart;
  let announceStart;
  const began = new Promise(resolve => { announceStart = resolve; });
  const gate = new Promise(resolve => { releaseStart = resolve; });
  const calls = [];
  try {
    const pg = createPostgresRuntime({ resourcesPath: f.home, env: f.env, platform: 'win32',
      execImpl: async (_exe, args) => {
        calls.push(args.at(-1));
        if (args.at(-1) === 'status') throw Object.assign(Error('offline'), { code: 3 });
        if (args.at(-1) === 'start') { announceStart(); await gate; }
      },
    });
    const starting = assert.rejects(pg.start(), /Zamknięto/);
    await began;
    let stopped = false;
    const stopping = pg.stop().then(() => { stopped = true; });
    await Promise.resolve();
    assert.equal(stopped, false);
    releaseStart();
    await Promise.all([starting, stopping]);
    assert.deepEqual(calls, ['status', 'start', 'stop']);
  } finally { releaseStart?.(); f.cleanup(); }
});

test('database lifecycle aborts bootstrap and waits for its cleanup before shutdown', async () => {
  let releaseCleanup;
  let signal;
  let factories = 0;
  const cleanup = new Promise(resolve => { releaseCleanup = resolve; });
  const pg = createDatabaseLifecycle({
    bootstrapImpl: async options => {
      signal = options.signal;
      await new Promise(resolve => signal.addEventListener('abort', resolve, { once: true }));
      await cleanup;
      throw Error('bootstrap cancelled');
    },
    runtimeFactory: () => { factories++; throw Error('should not start'); },
  });
  const starting = assert.rejects(pg.start({}), /cancelled/);
  let stopped = false;
  const stopping = pg.stop().then(() => { stopped = true; });
  assert.equal(signal.aborted, true);
  await Promise.resolve();
  assert.equal(stopped, false);
  releaseCleanup();
  await Promise.all([starting, stopping]);
  assert.equal(factories, 0);
  await assert.rejects(pg.start({}), /zamykanie/);
});
test('wrong port in backend.env cannot start silently using Docker database', () => {
  const f = fixture();
  try {
    fs.writeFileSync(path.join(f.folder, 'JarvisData', 'backend.env'), f.envtext.replace('55432', '5433'));
    assert.throws(() => locations(f.home, f.env, fs, 'win32'), /backend.env/);
  } finally { f.cleanup(); }
});
