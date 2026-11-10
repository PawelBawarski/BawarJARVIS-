'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { validateRequest, uniqueReplacement, shouldCopy, copyProjectScope, dockerArgs,
  parseReport, runProjectTest, registerProjectTestIpc } = require('./agent-project-test.cjs');
const valid = {operation:'test',relativePath:'frontend/src/app/sample.ts',
  original:'export const x = 1;',proposed:'export const x = 2;'};
function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(),'jarvis-test-fixture-'));
  const create = (rel, content) => {
    const dest=path.join(root,rel); fs.mkdirSync(path.dirname(dest),{recursive:true}); fs.writeFileSync(dest,content);
  };
  create('frontend/package.json','{"name":"demo"}');
  create('frontend/angular.json','{}');
  create('frontend/src/app/sample.ts','export const x = 1;\n');
  create('frontend/src/app/sample.spec.ts','import {test} from "vitest";');
  create('frontend/src/app/secret.env','SHOULD_NOT_COPY');
  create('backend/pom.xml','<project/>');
  create('backend/src/main/java/Demo.java','public class Demo {}');
  create('backend/src/test/resources/application.properties','spring.datasource.url=jdbc:h2:mem:test\nspring.datasource.password=\n');
  return {root,create,close:()=>fs.rmSync(root,{recursive:true,force:true})};
}
test('validates strictly fixed, source-only request and rejects extra fields',()=>{
  assert.equal(validateRequest(valid).scope,'frontend');
  assert.equal(validateRequest({...valid,relativePath:'backend/src/main/java/Demo.java'}).scope,'backend');
  for (const req of [
    {...valid,command:'rm -rf .'},
    {...valid,relativePath:'../frontend/src/app/sample.ts'},
    {...valid,relativePath:'frontend/node_modules/shell.ts'},
    {...valid,relativePath:'frontend/src/app/private.key'},
    {...valid,relativePath:'frontend/src/app/sample.ts',proposed:valid.original},
    {...valid,relativePath:'backend/pom.xml'},
    {...valid,proposed:'x'.repeat(8001)},
  ]) assert.throws(()=>validateRequest(req));
});
test('replaces a unique excerpt and refuses stale/ambiguous sources',()=>{
  assert.equal(uniqueReplacement('aXXb','XX','YY'),'aYYb');
  assert.throws(()=>uniqueReplacement('aabb','XX','YY'),/STALE_SOURCE/);
  assert.throws(()=>uniqueReplacement('XXabcXX','XX','YY'),/AMBIGUOUS_SOURCE/);
});
test('copies strict allowlist to disposable path without private files or edits to source',()=>{
  const f=fixture();
  const staging=fs.mkdtempSync(path.join(os.tmpdir(),'jarvis-test-stage-'));
  try {
    const summary=copyProjectScope(f.root,staging,'frontend',valid);
    assert.ok(summary.files>=3);
    assert.equal(fs.readFileSync(path.join(staging,'frontend/src/app/sample.ts'),'utf8'),'export const x = 2;\n');
    assert.equal(fs.readFileSync(path.join(f.root,'frontend/src/app/sample.ts'),'utf8'),'export const x = 1;\n');
    assert.equal(fs.existsSync(path.join(staging,'frontend/src/app/secret.env')),false);
  } finally { f.close();fs.rmSync(staging,{recursive:true,force:true}); }
});
test('does not copy forbidden directories (regardless of symlink permissions)',()=>{
  const f=fixture(); const stage=fs.mkdtempSync(path.join(os.tmpdir(),'jarvis-test-stage-'));
  try {
    f.create('frontend/node_modules/unsafe.ts','malware');
    copyProjectScope(f.root,stage,'frontend',valid);
    assert.equal(fs.existsSync(path.join(stage,'frontend/node_modules')),false);
  } finally { f.close();fs.rmSync(stage,{recursive:true,force:true}); }
});
test('does not copy symlinks; skip only if Windows blocks symlink creation',t=>{
  const f=fixture(); const stage=fs.mkdtempSync(path.join(os.tmpdir(),'jarvis-test-stage-'));
  try {
    try {
      fs.symlinkSync(path.join(f.root,'frontend/src/app/sample.ts'),path.join(f.root,'frontend/src/app/linked.ts'));
    } catch (error) {
      if (process.platform === 'win32' && ['EPERM', 'EACCES'].includes(error.code)) {
        t.skip('Windows denied creating a symlink (EPERM/EACCES); forbidden-directory security test still runs.');
        return;
      }
      throw error;
    }
    copyProjectScope(f.root,stage,'frontend',valid);
    assert.equal(fs.existsSync(path.join(stage,'frontend/src/app/linked.ts')),false);
  } finally { f.close();fs.rmSync(stage,{recursive:true,force:true}); }
});
test('refuses backend test properties with nonempty passwords',()=>{
  const f=fixture();const stage=fs.mkdtempSync(path.join(os.tmpdir(),'jarvis-test-stage-'));
  try {
    f.create('backend/src/test/resources/application.properties','spring.datasource.password=badsecret');
    assert.throws(()=>copyProjectScope(f.root,stage,'backend',{
      ...valid,scope:'backend',relativePath:'backend/src/main/java/Demo.java',original:'public class Demo {}',proposed:'public class Demo { int x; }',
    }),/SENSITIVE_TEST_CONFIGURATION/);
  } finally { f.close(); fs.rmSync(stage,{recursive:true,force:true}); }
});
test('docker runner has fixed commands, no network, no docker socket, read-only source',()=>{
  const flags=dockerArgs('/tmp/jarvis-project-test-123','frontend','jarvis-proj-abcdef');
  const cmd=flags.join(' ');
  for (const required of ['--pull=never','--network none','--read-only','--cap-drop=ALL','no-new-privileges','--user 65534:65534','readonly','ng build','ng test --watch=false'])
    assert.match(cmd,new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  assert.doesNotMatch(cmd,/docker\.sock|--privileged|--network host|--device/);
  assert.equal(shouldCopy('frontend','src/app/a.ts'),true);
  assert.equal(shouldCopy('frontend','src/app/a.env'),false);
});
test('report only marks actual finished builds and tests as passed',()=>{
  assert.equal(parseReport({exitCode:0,stdout:'[JARVIS] ANGULAR_BUILD_OK\n[JARVIS] ANGULAR_TEST_OK',stderr:''},'frontend').status,'passed');
  assert.notEqual(parseReport({exitCode:0,stdout:'',stderr:''},'frontend').status,'passed');
  assert.equal(parseReport({exitCode:1,stdout:'[JARVIS] ANGULAR_BUILD_FAILED',stderr:'Error'},'frontend').status,'failed');
  assert.equal(parseReport({exitCode:1,stdout:'',stderr:'No such image'},'frontend').status,'unavailable');
});
test('no Docker is invoked when preview source is stale',async()=>{
  const f=fixture();let called=false;
  try {
    const access={root:()=>f.root,resolve:()=>path.join(f.root,valid.relativePath)};
    const out=await runProjectTest({...valid,original:'unknown excerpt'},{access,execute:async()=>{called=true;return {exitCode:0,stdout:'',stderr:''}}});
    assert.equal(out.status,'unavailable'); assert.match(out.message,/STALE_SOURCE/); assert.equal(called,false);
  } finally {f.close();}
});
test('reports simulated success after copying; no actual Docker calls during unit tests',async()=>{
  const f=fixture();let commands=0;
  try {
    const access={root:()=>f.root,resolve:()=>path.join(f.root,valid.relativePath)};
    const out=await runProjectTest(valid,{access,execute:async args=>{commands++; assert.ok(args.includes('--network')); return {exitCode:0,stdout:'[JARVIS] ANGULAR_BUILD_OK\n[JARVIS] ANGULAR_TEST_OK',stderr:''};},cleanup:async()=>({exitCode:0})});
    assert.equal(out.status,'passed');assert.equal(commands,1);
    assert.equal(fs.readFileSync(path.join(f.root,valid.relativePath),'utf8'),'export const x = 1;\n');
  } finally { f.close(); }
});
test('Electron IPC rejects untrusted senders before reading workspace',async()=>{
  let handler;
  const ipc={handle:(name,fn)=>{assert.equal(name,'jarvis:agent-project-test');handler=fn;}};
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'jarvis-ipc-'));
  try {registerProjectTestIpc(ipc,()=>false,{userDataDir:dir});
    await assert.rejects(()=>handler({},valid),/UNTRUSTED_IPC_SENDER/);
  } finally {fs.rmSync(dir,{recursive:true,force:true});}
});
