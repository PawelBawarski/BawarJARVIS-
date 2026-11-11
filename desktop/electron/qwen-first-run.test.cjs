'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const {
  OFFICIAL_SHA256, OFFICIAL_URL, assertAllowedUrl, openTrustedStream,
  commitModel, ensureFirstRunModel, cancelFirstRunModel,
} = require('./qwen-first-run.cjs');
const MODEL = 'Qwen3-8B-Q4_K_M.gguf';
const bytes = Buffer.from('GGUF test-only bytes; nothing downloaded from the Internet');
const expected = { size: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex') };
function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-qwen-1762-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const source = path.join(dir, 'input.gguf');
  fs.writeFileSync(source, bytes);
  const dst = path.join(dir, 'LOCALAPPDATA', 'J.A.R.V.I.S.', 'models', MODEL);
  return { dir, source, dst };
}
function noPartials(dst) {
  if (fs.existsSync(path.dirname(dst))) {
    assert.deepEqual(fs.readdirSync(path.dirname(dst)).filter(x => x.endsWith('.partial')), []);
  }
}

test('17.6.2: only official HTTPS and allowlisted redirect hosts', () => {
  assert.equal(assertAllowedUrl(OFFICIAL_URL).protocol, 'https:');
  for (const url of ['http://huggingface.co/test', 'https://evil.com/model',
    'https://huggingface.co.evil.com/a', 'https://user@huggingface.co/a',
    'https://huggingface.co:1234/model']) {
    assert.throws(() => assertAllowedUrl(url), /niedozwolone/);
  }
});

test('17.6.2: allowed redirect works and disables credentials/cookies', async () => {
  const seen = [];
  const payload = new ReadableStream({ start(c) { c.enqueue(bytes); c.close(); } });
  const response = await openTrustedStream(OFFICIAL_URL, {
    fetchImpl: async (url, opt) => {
      seen.push([url, opt]);
      if (seen.length === 1) return { status: 302, headers: new Headers({location: 'https://cdn-lfs-us-1.hf.co/fake'}), body: null };
      return { status: 200, headers: new Headers(), body: payload };
    },
    signal: new AbortController().signal,
  });
  assert.equal(response.status, 200);
  assert.equal(seen.length, 2);
  assert.equal(seen[0][1].redirect, 'manual');
  assert.equal(seen[0][1].credentials, 'omit');
  assert.match(seen[1][0], /cdn-lfs-us-1\.hf\.co/);
});

test('17.6.2: rejects redirect to foreign host', async () => {
  await assert.rejects(openTrustedStream(OFFICIAL_URL, {
    fetchImpl: async () => ({status:302, headers:new Headers({location:'https://127.0.0.1/private'}), body:null}),
    signal:new AbortController().signal,
  }), /niedozwolone/);
});

test('17.6.2: accepts matching existing GGUF, no temp file', async t => {
  const {source,dst} = fixture(t);
  const progress=[];
  await commitModel({kind:'file',file:source},dst,expected,{onProgress:pct=>progress.push(pct)});
  assert.deepEqual(fs.readFileSync(dst), bytes);
  assert.equal(progress.at(-1), 100);
  noPartials(dst);
});

test('17.6.2: refuses overwrite without damaging the existing model', async t => {
  const {source,dst} = fixture(t);
  fs.mkdirSync(path.dirname(dst),{recursive:true});
  fs.writeFileSync(dst,'existing user file');
  await assert.rejects(commitModel({kind:'file',file:source},dst,expected), /już istnieje/);
  assert.equal(fs.readFileSync(dst,'utf8'),'existing user file');
  noPartials(dst);
});

test('17.6.2: rejects wrong digest and leaves destination unchanged', async t => {
  const {source,dst} = fixture(t);
  await assert.rejects(commitModel({kind:'file',file:source},dst,{...expected,sha256:'f'.repeat(64)}),/SHA-256/);
  assert.equal(fs.existsSync(dst),false);
  noPartials(dst);
});

test('17.6.2: rejects incorrect size even before copying', async t => {
  const {source,dst} = fixture(t);
  await assert.rejects(commitModel({kind:'file',file:source},dst,{...expected,size:expected.size+5}),/rozmiar/);
  assert.equal(fs.existsSync(dst),false);
  noPartials(dst);
});

test('17.6.2: source with symlink is blocked when platform permits symlinks', async t => {
  const {source,dst,dir}=fixture(t);
  const link=path.join(dir,'indirection.gguf');
  try { fs.symlinkSync(source,link); }
  catch(e) { if (['EPERM','EACCES','UNKNOWN'].includes(e.code) || e.code === 'ERR_FS_CP_EINVAL') return t.skip('Windows does not allow test symlink'); throw e; }
  await assert.rejects(commitModel({kind:'file',file:link},dst,expected),/symlink|dowiązanie/i);
  assert.equal(fs.existsSync(dst),false);
});

test('17.6.2: cannot download non-official variant', async t => {
  const {dst}=fixture(t);
  await assert.rejects(commitModel({kind:'download',fetchImpl:async()=>{throw Error('should not fetch');}},dst,expected),/zatwierdzonego adresu/);
  assert.equal(fs.existsSync(dst),false);
});

test('17.6.2: full first-run local-file flow invokes no network', async t => {
  const {dir,source,dst}=fixture(t);
  let selected=0, progressed=0;
  const env={LOCALAPPDATA:path.join(dir,'LOCALAPPDATA')};
  const resourcesPath=path.join(dir,'resources');fs.mkdirSync(resourcesPath);
  const result=await ensureFirstRunModel({resourcesPath,env,platform:'win32',
    getExpected:()=>expected,
    resolveExisting:()=>{if(!fs.existsSync(dst))throw Error('Brak modelu Qwen3 8B.');return dst;},
    uiFactory:allowDownload=>({
      choose:async()=>{assert.equal(allowDownload,false);selected++;return 'file';},
      pickFile:async()=>source,
      progress:()=>({set:()=>{progressed++;},close:()=>{}}),
    }),
  });
  assert.equal(result,dst);
  assert.equal(selected,1);
  assert.ok(progressed>0);
  noPartials(dst);
});

test('17.6.2: cancellation leaves no model or partials', async t => {
  const {dir,dst}=fixture(t);
  const resourcesPath=path.join(dir,'resources');fs.mkdirSync(resourcesPath);
  await assert.rejects(ensureFirstRunModel({resourcesPath,env:{LOCALAPPDATA:path.join(dir,'LOCALAPPDATA')},platform:'win32',
    getExpected:()=>expected,
    resolveExisting:()=>{throw Error('Brak modelu Qwen3 8B.');},
    uiFactory:()=>({choose:async()=> 'cancel'})
  }),/Anulowano/);
  assert.equal(fs.existsSync(dst),false);
});

test('17.6.2: no prompt when existing model passes verification', async t => {
  const {dir,dst}=fixture(t);
  const resourcesPath=path.join(dir,'resources');fs.mkdirSync(resourcesPath);
  let prompts=0;
  const res=await ensureFirstRunModel({resourcesPath,env:{LOCALAPPDATA:path.join(dir,'LOCALAPPDATA')},platform:'win32',
    getExpected:()=>expected,resolveExisting:()=>dst,
    uiFactory:()=>{prompts++;throw Error('Unexpected prompt');}
  });
  assert.equal(res,dst);assert.equal(prompts,0);
});

test('17.6.2: suspicious existing model is not silently replaced', async t => {
  const {dir,dst}=fixture(t);
  const resourcesPath=path.join(dir,'resources');fs.mkdirSync(resourcesPath);
  await assert.rejects(ensureFirstRunModel({resourcesPath,env:{LOCALAPPDATA:path.join(dir,'LOCALAPPDATA')},platform:'win32',
    getExpected:()=>expected,resolveExisting:()=>{throw Error('Qwen: SHA-256 jest niezgodny');},
    uiFactory:()=>{throw Error('should not prompt');}
  }),/SHA-256/);
});

test('17.6.2: rejects unexpected remote content type by digest', async t => {
  const {dst}=fixture(t);
  await assert.rejects(commitModel({kind:'file',file:path.join(__dirname,'qwen-first-run.cjs')},dst,expected),/rozmiar/);
});
