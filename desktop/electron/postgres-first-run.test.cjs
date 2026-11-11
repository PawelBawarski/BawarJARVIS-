'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { bootstrap, ensureFirstRunDatabase, pathsFor, validateStage, stopNewPostmaster } = require('./postgres-first-run.cjs');
function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-1761-'));
  const resourcesPath = path.join(dir, 'resources');
  const pgBin = path.join(resourcesPath, 'postgres', 'bin');
  fs.mkdirSync(pgBin, {recursive:true});
  const names = ['pg_ctl.exe', 'postgres.exe', 'initdb.exe', 'createdb.exe', 'psql.exe'];
  for (const name of names) fs.writeFileSync(path.join(pgBin, name), name);
  const hash = name => crypto.createHash('sha256').update(name).digest('hex');
  fs.writeFileSync(path.join(resourcesPath, 'postgres', 'stage17-3-manifest.json'), JSON.stringify({
    schema: 'jarvis.pg.binaries.v1', version: 'postgres (PostgreSQL) 17.6',
    postgres_sha256: hash('postgres.exe'), initdb_sha256: hash('initdb.exe'),
  }));
  const env = {APPDATA: path.join(dir, 'appdata'), SystemRoot: path.join(dir, 'windows')};
  const p = pathsFor(resourcesPath, env, fs, 'win32');
  const calls = [];
  let failInit = false;
  let failCreate = false;
  const execImpl = async (exe, args, opts) => {
    calls.push({exe, args, opts});
    if (path.basename(exe) === 'whoami.exe') return {stdout: '"COMPUTER\\User","S-1-5-21-101-202-303-404"\r\n'};
    if (path.basename(exe) === 'initdb.exe') {
      if (failInit) throw Object.assign(new Error('secret diagnostic'), {code:1});
      fs.mkdirSync(p.dataDir, {recursive:true});
      fs.writeFileSync(path.join(p.dataDir, 'PG_VERSION'), '17\n');
      fs.writeFileSync(path.join(p.dataDir, 'postgresql.conf'), 'existing config\n');
      fs.writeFileSync(path.join(p.dataDir, 'pg_hba.conf'), 'initial config\n');
    }
    if (path.basename(exe) === 'createdb.exe' && failCreate) throw Object.assign(new Error('secret diagnostic'), {code:1});
    if (path.basename(exe) === 'psql.exe') return {stdout: 'jarvis_db\n'};
    return {stdout:''};
  };
  const options = {resourcesPath, env, execImpl, platform:'win32', busyImpl: async()=>false,
    random: () => Buffer.alloc(48, 63)};
  return {dir, resourcesPath, env, p, calls, options,
    failInit(v) {failInit=v;}, failCreate(v) {failCreate=v;},
    cleanup() {fs.rmSync(dir, {recursive:true,force:true})}};
}
test('17.6.1 creates a clean, private database without a Python or Docker process', async () => {
  const f = fixture();
  try {
    assert.deepEqual(await bootstrap(f.options), {mode:'fresh', created:true});
    const state = JSON.parse(fs.readFileSync(f.p.stateFile,'utf8'));
    assert.equal(state.initializedFresh, true);
    assert.equal(state.migrated, false);
    assert.equal(state.activated, true);
    assert.equal(state.port, 55432);
    assert.match(fs.readFileSync(f.p.envFile,'utf8'), /JARVIS_DB_HOST=127\.0\.0\.1/);
    assert.match(fs.readFileSync(f.p.envFile,'utf8'), /JARVIS_DB_PORT=55432/);
    assert.match(fs.readFileSync(path.join(f.p.dataDir,'pg_hba.conf'),'utf8'), /scram-sha-256/);
    assert(!fs.existsSync(path.join(f.p.stateDir,'.initdb-secret')));
    const cmds = f.calls.map(c=>path.basename(c.exe));
    assert.deepEqual(cmds.filter(v=>!['icacls.exe','whoami.exe'].includes(v)),
      ['initdb.exe','pg_ctl.exe','createdb.exe','psql.exe','pg_ctl.exe']);
    assert(f.calls.every(c => c.opts.shell === false && c.opts.windowsHide === true));
    const secret = JSON.parse(fs.readFileSync(f.p.secretFile,'utf8')).password;
    assert(f.calls.every(c => !JSON.stringify(c.args).includes(secret)));
    assert(f.calls.some(c => path.basename(c.exe) === 'icacls.exe' && c.args.includes('/inheritance:r')));
    assert(f.calls.some(c => path.basename(c.exe) === 'createdb.exe' && c.opts.env.PGPASSWORD === secret));
    assert.deepEqual(await bootstrap(f.options), {mode:'existing', created:false});
    assert.equal(f.calls.filter(c=>c.exe.endsWith('initdb.exe')).length,1);
  } finally {f.cleanup();}
});
test('17.6.1 keeps existing Docker backend.env and never initializes', async () => {
  const f=fixture();
  try {
    fs.mkdirSync(f.p.appDir,{recursive:true});
    fs.writeFileSync(f.p.envFile,'JARVIS_DB_HOST=127.0.0.1\nJARVIS_DB_PORT=5433\nJARVIS_DB_PASSWORD=private\n');
    assert.deepEqual(await bootstrap(f.options), {mode:'existing',created:false});
    assert.equal(f.calls.length,0);
    assert(!fs.existsSync(f.p.stateDir));
  } finally {f.cleanup();}
});
test('17.6.1 refuses to reinitialize partially completed or migrated cluster', async () => {
  const f=fixture();
  try {
    fs.mkdirSync(f.p.stateDir,{recursive:true});
    fs.writeFileSync(path.join(f.p.stateDir,'keep.txt'),'DO NOT TOUCH');
    assert.deepEqual(await bootstrap(f.options), {mode:'existing',created:false});
    assert.equal(fs.readFileSync(path.join(f.p.stateDir,'keep.txt'),'utf8'),'DO NOT TOUCH');
    assert.equal(f.calls.length,0);
  } finally {f.cleanup();}
});
test('17.6.1 refuses occupied port before touching disk', async () => {
  const f=fixture();
  try {
    await assert.rejects(bootstrap({...f.options, busyImpl:async()=>true}), /Port 55432/);
    assert(!fs.existsSync(f.p.stateDir));
  } finally {f.cleanup();}
});
test('17.6.1 refuses corrupt PostgreSQL binaries before creating secrets', async () => {
  const f=fixture();
  try {
    fs.appendFileSync(f.p.postgres, 'tampered');
    assert.throws(()=>validateStage(f.p),/integralności/);
    await assert.rejects(bootstrap(f.options),/integralności/);
    assert(!fs.existsSync(f.p.stateDir));
  } finally {f.cleanup();}
});
test('17.6.1 leaves partial cluster untouched and never leaves initdb pwfile', async () => {
  const f=fixture();
  try {
    f.failInit(true);
    await assert.rejects(bootstrap(f.options), /initdb.exe/);
    assert(fs.existsSync(f.p.stateDir));
    assert(!fs.existsSync(f.p.stateFile));
    assert(!fs.existsSync(f.p.envFile));
    assert(!fs.existsSync(path.join(f.p.stateDir,'.initdb-secret')));
    f.failInit(false);
    assert.deepEqual(await bootstrap(f.options), {mode:'existing',created:false});
    assert.equal(f.calls.filter(c=>c.exe.endsWith('initdb.exe')).length,1);
  } finally {f.cleanup();}
});
test('17.6.1 does not activate a failed createdb database', async () => {
  const f=fixture();
  try {
    f.failCreate(true);
    await assert.rejects(bootstrap(f.options), /createdb.exe/);
    assert(!fs.existsSync(f.p.stateFile));
    assert(!fs.existsSync(f.p.envFile));
    assert(f.calls.filter(c=>c.exe.endsWith('pg_ctl.exe') && c.args.at(-1)==='stop').length>0);
  } finally {f.cleanup();}
});
test('17.6.1 refuses suspicious inherited process database credentials', async () => {
  const f=fixture();
  try {
    await assert.rejects(bootstrap({...f.options, env:{...f.env,JARVIS_DB_PORT:'5433'}}),/JARVIS_DB_PORT/);
    assert(!fs.existsSync(f.p.stateDir));
  } finally {f.cleanup();}
});
test('17.6.1 refuses unsupported platform', async () => {
  const f=fixture();
  try {await assert.rejects(bootstrap({...f.options,platform:'linux'}),/Windows/);}finally{f.cleanup();}
});
test('17.6.1 rejects symlinks in PostgreSQL resources', async (t) => {
  const f=fixture();
  try {
    const to=path.join(f.p.bin,'initdb.exe');
    const real=path.join(f.p.bin,'initdb.real');
    fs.renameSync(to,real);
    try {fs.symlinkSync(real,to);} catch(e) {
      if(['EPERM','EACCES'].includes(e.code)) return t.skip('System nie pozwala tworzyć symlinków');
      throw e;
    }
    await assert.rejects(bootstrap(f.options),/symlink/);
  } finally {f.cleanup();}
});
test('17.6.1 coalesces concurrent first-run initialization', async () => {
  const f=fixture();
  try {
    const [a,b] = await Promise.all([ensureFirstRunDatabase(f.options),ensureFirstRunDatabase(f.options)]);
    assert.deepEqual(a,b);
    assert.equal(f.calls.filter(c=>c.exe.endsWith('initdb.exe')).length,1);
  } finally {f.cleanup();}
});
test('17.6.1 integrates with 17.3 runtime while retaining migration-only safeguards', async () => {
  const f=fixture();
  try {
    await bootstrap(f.options);
    const {locations} = require('./postgres-runtime.cjs');
    const info=locations(f.resourcesPath, f.env, fs, 'win32');
    assert.equal(info.dataDir, f.p.dataDir);
    const state = JSON.parse(fs.readFileSync(f.p.stateFile,'utf8'));
    state.initializedFresh=false;
    fs.writeFileSync(f.p.stateFile,JSON.stringify(state));
    assert.throws(()=>locations(f.resourcesPath,f.env,fs,'win32'),/aktywowana/);
    state.migrated=true;
    fs.writeFileSync(f.p.stateFile,JSON.stringify(state));
    assert.equal(locations(f.resourcesPath,f.env,fs,'win32').dataDir,f.p.dataDir);
  } finally {f.cleanup();}
});

test('preserves legacy data instead of silently creating an empty replacement database', async () => {
  for (const name of ['backend.env', 'postgres17']) {
    const f = fixture();
    try {
      const legacy = path.join(f.env.APPDATA, 'J.A.R.V.I.S.');
      fs.mkdirSync(legacy, { recursive: true });
      const file = path.join(legacy, name);
      if (name === 'postgres17') fs.mkdirSync(file);
      else fs.writeFileSync(file, 'EXISTING_CONFIGURATION=1\n');
      await assert.rejects(bootstrap(f.options), /JARVIS_LEGACY_DB_DATA/);
      assert.equal(f.calls.length, 0);
      assert.equal(fs.existsSync(f.p.stateDir), false);
      assert.equal(fs.existsSync(file), true);
    } finally { f.cleanup(); }
  }
});

function postmaster(f, { directory = f.p.dataDir, port = 55432,
  startedAt = Math.floor(Date.now() / 1000) } = {}) {
  fs.writeFileSync(path.join(f.p.dataDir, 'postmaster.pid'),
    `12345\n${directory}\n${startedAt}\n${port}\n\n127.0.0.1\n\nready\n`);
}

test('persists a private recovery credential before native initialization', async () => {
  const f = fixture();
  const execute = f.options.execImpl;
  try {
    await bootstrap({ ...f.options, execImpl: async (exe, args, options) => {
      if (path.basename(exe) === 'initdb.exe') {
        assert.equal(fs.existsSync(f.p.secretFile), true);
        assert.equal(fs.existsSync(f.p.stateFile), false);
        assert.equal(fs.existsSync(f.p.envFile), false);
      }
      return execute(exe, args, options);
    } });
  } finally { f.cleanup(); }
});

test('failed pg_ctl after starting this cluster performs verified cleanup without activating data', async () => {
  const f = fixture();
  const execute = f.options.execImpl;
  try {
    await assert.rejects(bootstrap({ ...f.options, ownershipImpl: async () => true, execImpl: async (exe, args, options) => {
      if (path.basename(exe) === 'pg_ctl.exe' && args.at(-1) === 'start') {
        assert.equal(fs.existsSync(f.p.secretFile), true);
        postmaster(f);
        throw Object.assign(Error('private stderr must not escape'), { code: 'ETIMEDOUT', controllerPid: 333 });
      }
      return execute(exe, args, options);
    } }), /Niepowodzenie: pg_ctl.exe/);
    assert.deepEqual(f.calls.filter(c => c.exe.endsWith('pg_ctl.exe')).map(c => c.args.at(-1)), ['status', 'stop']);
    assert.equal(fs.existsSync(f.p.stateFile), false);
    assert.equal(fs.existsSync(f.p.envFile), false);
    assert.equal(fs.existsSync(f.p.secretFile), true);
    assert.equal(fs.existsSync(path.join(f.p.stateDir, '.initdb-secret')), false);
  } finally { f.cleanup(); }
});

test('failed start never stops a missing, stale or unrelated postmaster', async () => {
  for (const marker of [null, { directory: path.resolve('unrelated-cluster') },
    { startedAt: 1 }, { port: 5433 }]) {
    const f = fixture();
    const execute = f.options.execImpl;
    try {
      await assert.rejects(bootstrap({ ...f.options, execImpl: async (exe, args, options) => {
        if (path.basename(exe) === 'pg_ctl.exe' && args.at(-1) === 'start') {
          if (marker) postmaster(f, marker);
          throw Error('start failed');
        }
        return execute(exe, args, options);
      } }), /pg_ctl.exe/);
      assert.equal(f.calls.some(c => c.exe.endsWith('pg_ctl.exe') && c.args.at(-1) === 'stop'), false);
      assert.equal(fs.existsSync(f.p.secretFile), true);
    } finally { f.cleanup(); }
  }
});

test('cancellation during bootstrap stops its server using a non-aborted cleanup command', async () => {
  const f = fixture();
  const execute = f.options.execImpl;
  const controller = new AbortController();
  try {
    await assert.rejects(bootstrap({ ...f.options, signal: controller.signal,
      execImpl: async (exe, args, options) => {
        if (path.basename(exe) === 'pg_ctl.exe' && args.at(-1) === 'start') controller.abort();
        if (path.basename(exe) === 'pg_ctl.exe' && args.at(-1) === 'stop') assert.equal(options.signal, undefined);
        return execute(exe, args, options);
      },
    }), /Niepowodzenie/);
    assert.equal(f.calls.some(c => c.exe.endsWith('pg_ctl.exe') && c.args.at(-1) === 'stop'), true);
    assert.equal(fs.existsSync(f.p.secretFile), true);
    assert.equal(fs.existsSync(f.p.envFile), false);
    assert.equal(fs.existsSync(f.p.stateFile), false);
  } finally { f.cleanup(); }
});

test('an app-directory ACL failure leaves no plaintext database credentials', async () => {
  const f = fixture();
  const execute = f.options.execImpl;
  try {
    await assert.rejects(bootstrap({ ...f.options, execImpl: async (exe, args, options) => {
      if (path.basename(exe) === 'icacls.exe' && args[0] === f.p.appDir) throw Error('private native error');
      return execute(exe, args, options);
    } }), /icacls.exe/);
    assert.equal(fs.existsSync(f.p.envFile), false);
    assert.equal(fs.existsSync(f.p.secretFile), false);
    assert.equal(fs.existsSync(f.p.stateDir), false);
  } finally { f.cleanup(); }
});

test('new marker and port alone never authorize stopping another controller server', async () => {
  const f = fixture();
  try {
    fs.mkdirSync(f.p.dataDir, { recursive: true });
    postmaster(f);
    let called = false;
    const stopped = await stopNewPostmaster({ dataDir: f.p.dataDir, before: null,
      attemptedAt: Date.now(), controllerPid: 333, ownershipImpl: async () => false,
      command: async () => { called = true; },
    });
    assert.equal(stopped, false);
    assert.equal(called, false);
    assert.equal(fs.existsSync(path.join(f.p.dataDir, 'postmaster.pid')), true);
  } finally { f.cleanup(); }
});

test('failed start waits briefly for its own descendant to write the PID marker', async () => {
  const f = fixture();
  let timer;
  try {
    fs.mkdirSync(f.p.dataDir, { recursive: true });
    timer = setTimeout(() => postmaster(f), 20);
    const calls = [];
    const stopped = await stopNewPostmaster({ dataDir: f.p.dataDir, before: null,
      attemptedAt: Date.now(), controllerPid: 333, ownershipImpl: async () => true,
      command: async args => { calls.push(args.at(-1)); },
    });
    assert.equal(stopped, true);
    assert.deepEqual(calls, ['status', 'stop']);
  } finally { clearTimeout(timer); f.cleanup(); }
});

test('changed PID marker during ownership checks is preserved without stopping it', async () => {
  const f = fixture();
  try {
    fs.mkdirSync(f.p.dataDir, { recursive: true });
    postmaster(f);
    const calls = [];
    const stopped = await stopNewPostmaster({ dataDir: f.p.dataDir, before: null,
      attemptedAt: Date.now(), controllerPid: 333, ownershipImpl: async () => true,
      command: async args => {
        calls.push(args.at(-1));
        if (args.at(-1) === 'status') fs.appendFileSync(path.join(f.p.dataDir, 'postmaster.pid'), 'changed\n');
      },
    });
    assert.equal(stopped, false);
    assert.deepEqual(calls, ['status']);
  } finally { f.cleanup(); }
});
