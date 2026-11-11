'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { noSymlinks, hashSync, expectedModel, resolveVerifiedQwenModel, MODEL } = require('./qwen-model-path.cjs');
function create(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis17-5-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const resource = path.join(root, 'resources');
  fs.mkdirSync(path.join(resource, 'llm'), { recursive:true });
  return { root, resource };
}
test('17.5: small-file SHA256 is deterministic', (t) => {
  const {root} = create(t);
  const file = path.join(root, 'test'); fs.writeFileSync(file, 'abc');
  assert.equal(hashSync(file), crypto.createHash('sha256').update('abc').digest('hex'));
});
test('17.5: wrong manifest cannot redirect model path', (t) => {
  const {resource} = create(t);
  fs.writeFileSync(path.join(resource, 'llm', 'stage17-4-manifest.json'), JSON.stringify({schema:'other',files:[]}));
  assert.throws(() => expectedModel(resource), /manifest/);
});
test('17.5: missing model refuses to launch even with valid source manifest', (t) => {
  const {resource,root} = create(t);
  const payload = {schema:'jarvis.ai17.4.v1',files:[{path:`models/${MODEL}`,size:1000000000,sha256:'0'.repeat(64)}]};
  fs.writeFileSync(path.join(resource,'llm','stage17-4-manifest.json'),JSON.stringify(payload));
  assert.throws(() => resolveVerifiedQwenModel({resourcesPath:resource,platform:'win32',env:{LOCALAPPDATA:path.join(root,'profile')}}), /Brak modelu/);
});
test('17.5: no symlinks in model storage', (t) => {
  const {root}=create(t);
  const file=path.join(root,'data'); fs.writeFileSync(file,'GGUF');
  const link=path.join(root,'link');
  try { fs.symlinkSync(file,link,'file'); }
  catch (error) { if (['EPERM','EACCES'].includes(error.code)) return; throw error; }
  assert.throws(()=>noSymlinks(link),/symlink/);
});
test('17.5: runtime loads verified persistent model and rejects tampering', (t) => {
  const {root,resource}=create(t);
  const profile=path.join(root,'profile');
  const model=path.join(profile,'J.A.R.V.I.S.','models',MODEL);
  fs.mkdirSync(path.dirname(model),{recursive:true});
  fs.writeFileSync(model,'GGUF fake fixture');
  const sha=hashSync(model);
  const manifest={schema:'jarvis.ai17.4.v1',files:[{path:`models/${MODEL}`,size:1_000_000_000,sha256:sha}]};
  fs.writeFileSync(path.join(resource,'llm','stage17-4-manifest.json'),JSON.stringify(manifest));
  // No 1 GB temporary model: inject a size-only test double, keep real read and hashing.
  const fsImpl={...fs,statSync(p) {
    const actual=fs.statSync(p);
    return path.resolve(p)===path.resolve(model) ? Object.assign(Object.create(actual),{size:1_000_000_000}) : actual;
  }};
  assert.equal(resolveVerifiedQwenModel({resourcesPath:resource,platform:'win32',env:{LOCALAPPDATA:profile},fsImpl}),model);
  fs.appendFileSync(model,'tamper');
  assert.throws(()=>resolveVerifiedQwenModel({resourcesPath:resource,platform:'win32',env:{LOCALAPPDATA:profile},fsImpl}),/SHA-256|rozmiar/);
});
