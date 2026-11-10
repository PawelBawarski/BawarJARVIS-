'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const {createDeploymentGate,registerWorkspaceApplyIpc,validateAction,BACKUP_DIR} = require('./agent-workspace-apply.cjs');
const {runProjectTest} = require('./agent-project-test.cjs');
const sha = data => crypto.createHash('sha256').update(data).digest('hex');
const patch = {operation:'test',relativePath:'frontend/src/app/sample.ts',original:'export const x = 1;',proposed:'export const x = 2;'};
function fixture(options={}) {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'jarvis-deploy-test-'));
  const root=path.join(dir,'workspace');const userDataDir=path.join(dir,'userData');
  const file=path.join(root,'frontend','src','app','sample.ts');
  fs.mkdirSync(path.dirname(file),{recursive:true});fs.mkdirSync(userDataDir);
  fs.writeFileSync(file,'export const x = 1;\n');
  fs.writeFileSync(path.join(root,'frontend','package.json'),'{"name":"demo"}');
  const access={root:()=>root,resolve:relative=>{assert.equal(relative,patch.relativePath);return file;}};
  let decision=options.decision??1;
  const dialog={showMessageBox:async ()=>({response:decision})};
  const gate=createDeploymentGate({userDataDir,access,dialog, now:options.now ?? Date.now});
  return {dir,root,file,userDataDir,access,dialog,gate,close:()=>fs.rmSync(dir,{recursive:true,force:true}),setDecision:v=>{decision=v;}};
}
const sourceHash = f => sha(fs.readFileSync(f.file));
test('strict IPC action envelope rejects paths/commands/invalid IDs',()=>{
  for(const input of [{operation:'apply',grantId:'bogus'}, {operation:'apply',grantId:'a'.repeat(48),path:'../x'},
    {operation:'apply',grantId:'a'.repeat(48),command:'echo unsafe'}, {operation:'rollback',deploymentId:'../x'}, {},null])
    assert.throws(()=>validateAction(input),/INVALID_APPLY_REQUEST/);
  assert.equal(validateAction({operation:'apply',grantId:'a'.repeat(48)}).operation,'apply');
  assert.equal(validateAction({operation:'history'}).operation,'history');
});
test('no grant is issued by renderer; a successful native test fingerprint is required',()=>{
  const f=fixture();try {
    assert.throws(()=>f.gate.issueGrant(patch,'x'.repeat(64)),/UNVERIFIED_TEST_RESULT/);
    assert.throws(()=>f.gate.issueGrant(patch,'0'.repeat(64)),/SOURCE_CHANGED_AFTER_TEST/);
    assert.match(f.gate.issueGrant(patch,sourceHash(f)),/^[a-f\d]{48}$/);
  } finally {f.close();}
});
test('one explicit native confirmation produces exactly one source change and private backup',async()=>{
  const f=fixture();try {
    const grantId=f.gate.issueGrant(patch,sourceHash(f));
    assert.equal(fs.readFileSync(f.file,'utf8'),'export const x = 1;\n');
    const out=await f.gate.handle({operation:'apply',grantId});
    assert.equal(out.status,'applied');
    assert.equal(fs.readFileSync(f.file,'utf8'),'export const x = 2;\n');
    const saved=path.join(f.userDataDir,BACKUP_DIR,out.deploymentId,'before.bin');
    assert.equal(fs.readFileSync(saved,'utf8'),'export const x = 1;\n');
    await assert.rejects(()=>f.gate.handle({operation:'apply',grantId}),/TEST_GRANT_EXPIRED_OR_MISSING/);
  } finally {f.close();}
});
test('native rejection never changes the original or issues backup',async()=>{
  const f=fixture({decision:0});try {
    const grantId=f.gate.issueGrant(patch,sourceHash(f));
    const result=await f.gate.handle({operation:'apply',grantId});
    assert.equal(result.status,'cancelled');
    assert.equal(fs.readFileSync(f.file,'utf8'),'export const x = 1;\n');
    assert.equal(fs.existsSync(path.join(f.userDataDir,BACKUP_DIR)),false);
  } finally {f.close();}
});
test('changed source after test or during native dialog is never overwritten',async()=>{
  const f=fixture();try {
    const grantId=f.gate.issueGrant(patch,sourceHash(f));
    fs.writeFileSync(f.file,'export const x = 99;\n');
    await assert.rejects(()=>f.gate.handle({operation:'apply',grantId}),/STALE_SOURCE_FILE/);
    assert.equal(fs.readFileSync(f.file,'utf8'),'export const x = 99;\n');
  }finally {f.close();}
  const next=fixture();try {
    const grantId=next.gate.issueGrant(patch,sourceHash(next));
    next.dialog.showMessageBox=async()=>{fs.writeFileSync(next.file,'manual edit');return {response:1};};
    await assert.rejects(()=>next.gate.handle({operation:'apply',grantId}),/STALE_SOURCE_FILE/);
    assert.equal(fs.readFileSync(next.file,'utf8'),'manual edit');
  }finally{next.close();}
});
test('rollback works after app restart and only with original workspace selected',async()=>{
  const f=fixture();try {
    const id=f.gate.issueGrant(patch,sourceHash(f));
    const deployed=await f.gate.handle({operation:'apply',grantId:id});
    const restarted=createDeploymentGate({userDataDir:f.userDataDir,access:f.access,dialog:f.dialog});
    const result=await restarted.handle({operation:'rollback',deploymentId:deployed.deploymentId});
    assert.equal(result.status,'rolled_back');
    assert.equal(fs.readFileSync(f.file,'utf8'),'export const x = 1;\n');
    await assert.rejects(()=>restarted.handle({operation:'rollback',deploymentId:deployed.deploymentId}),/ENOENT/);
  }finally {f.close();}
});
test('rollback cannot overwrite later user edits',async()=>{
  const f=fixture();try {
    const id=f.gate.issueGrant(patch,sourceHash(f));
    const deployed=await f.gate.handle({operation:'apply',grantId:id});
    fs.writeFileSync(f.file,'user changed it after applying\n');
    await assert.rejects(()=>f.gate.handle({operation:'rollback',deploymentId:deployed.deploymentId}),/ROLLBACK_FILE_CHANGED/);
    assert.equal(fs.readFileSync(f.file,'utf8'),'user changed it after applying\n');
  } finally {f.close();}
});
test('no test grant after expiry or after switching workspace',async()=>{
  let instant=1000;const f=fixture({now:()=>instant});try {
    const id=f.gate.issueGrant(patch,sourceHash(f));
    instant+=16*60*1000;
    await assert.rejects(()=>f.gate.handle({operation:'apply',grantId:id}),/TEST_GRANT_EXPIRED_OR_MISSING/);
  }finally {f.close();}
  const g=fixture();try {
    const id=g.gate.issueGrant(patch,sourceHash(g));
    g.access.root=()=>path.join(g.dir,'other');
    await assert.rejects(()=>g.gate.handle({operation:'apply',grantId:id}),/WORKSPACE_CHANGED/);
  }finally {g.close();}
});
test('invalid original, ambiguous source, outside-tree path cannot create grant',()=>{
  const f=fixture();try {
    for(const req of [{...patch,relativePath:'../../etc/passwd'}, {...patch,relativePath:'frontend/src/app/secret.env'},
      {...patch,original:'missing'}, {...patch,proposed:patch.original}])
      assert.throws(()=>f.gate.issueGrant(req,sourceHash(f)));
  }finally {f.close();}
});
test('untrusted renderer is rejected by Electron IPC before any effect',async()=>{
  const f=fixture();try {
    let handler;
    registerWorkspaceApplyIpc({handle:(channel,fn)=>{assert.equal(channel,'jarvis:agent-workspace-apply');handler=fn;}},()=>false,f.gate);
    await assert.rejects(()=>handler({}, {operation:'apply',grantId:'0'.repeat(48)}),/UNTRUSTED_IPC_SENDER/);
  }finally {f.close();}
});
test('rollback cancellation does not change source or consume record',async()=>{
  const f=fixture();try {
    const id=f.gate.issueGrant(patch,sourceHash(f));
    const deployed=await f.gate.handle({operation:'apply',grantId:id});
    f.setDecision(0);
    const outcome=await f.gate.handle({operation:'rollback',deploymentId:deployed.deploymentId});
    assert.equal(outcome.status,'cancelled');
    assert.equal(fs.readFileSync(f.file,'utf8'),'export const x = 2;\n');
    f.setDecision(1);
    assert.equal((await f.gate.handle({operation:'rollback',deploymentId:deployed.deploymentId})).status,'rolled_back');
  }finally {f.close();}
});

test('history survives restart but never exposes code or backups',async()=>{
  const f=fixture();try {
    const id=f.gate.issueGrant(patch,sourceHash(f));
    const out=await f.gate.handle({operation:'apply',grantId:id});
    const restarted=createDeploymentGate({userDataDir:f.userDataDir,access:f.access,dialog:f.dialog});
    const list=await restarted.handle({operation:'history'});
    assert.equal(list.status,'ok');
    assert.equal(list.deployments.length,1);
    assert.equal(list.deployments[0].deploymentId,out.deploymentId);
    assert.ok(!JSON.stringify(list).includes('export const x'));
    await restarted.handle({operation:'rollback',deploymentId:out.deploymentId});
    assert.equal((await restarted.handle({operation:'history'})).deployments.length,0);
  }finally{f.close();}
});

test('16.5 test result contains source SHA only when it really passed on stable source',async()=>{
  const f=fixture();try {
    const report=await runProjectTest(patch,{access:f.access,
      execute:async()=>({exitCode:0,stdout:'[JARVIS] ANGULAR_BUILD_OK\n[JARVIS] ANGULAR_TEST_OK',stderr:''}),
      cleanup:async()=>({exitCode:0}),
    });
    assert.equal(report.status,'passed');
    assert.equal(report.sourceSha256,sourceHash(f));
    assert.match(f.gate.issueGrant(patch,report.sourceSha256),/^[a-f\d]{48}$/);
  } finally {f.close();}
});
test('16.5 test result is inconclusive if original file changes while test container runs',async()=>{
  const f=fixture();try {
    const report=await runProjectTest(patch,{access:f.access,
      execute:async()=>{fs.writeFileSync(f.file,'manual concurrent edit\n');
        return {exitCode:0,stdout:'[JARVIS] ANGULAR_BUILD_OK\n[JARVIS] ANGULAR_TEST_OK',stderr:''};},
      cleanup:async()=>({exitCode:0}),
    });
    assert.equal(report.status,'inconclusive');
    assert.equal(report.sourceSha256,undefined);
  } finally {f.close();}
});
