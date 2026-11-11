'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const SOURCE=path.resolve(__dirname,'../../electron-builder.stage17-5.config.cjs');
function setup(t,mutate=()=>{}){
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'jarvis175-builder-'));
  t.after(()=>fs.rmSync(temp,{recursive:true,force:true}));
  fs.copyFileSync(SOURCE,path.join(temp,'electron-builder.stage17-5.config.cjs'));
  const base={appId:'pl.bawar.jarvis',productName:'J.A.R.V.I.S.',win:{},nsis:{},
   extraResources:[{from:'desktop/resources/java',to:'java'},
    {from:'desktop/resources/postgres',to:'postgres'},
    {from:'desktop/ai-runtime',to:'llm',filter:['bin/**/*','models/**/*']}],
   files:['desktop/electron/**/*']};
  mutate(base);
  fs.writeFileSync(path.join(temp,'electron-builder.stage17-4.config.cjs'),'module.exports='+JSON.stringify(base)+';');
  return path.join(temp,'electron-builder.stage17-5.config.cjs');
}
test('17.5: keeps app identity, Github updates, and excludes large model',t=>{
  const config=require(setup(t));
  assert.equal(config.appId,'pl.bawar.jarvis');
  assert.equal(config.productName,'J.A.R.V.I.S.');
  assert.deepEqual(config.publish,[{provider:'github',owner:'PawelBawarski',repo:'BawarJARVIS-'}]);
  assert.equal(config.nsis.deleteAppDataOnUninstall,false);
  assert.equal(config.nsis.perMachine,false);
  assert.equal(config.nsis.oneClick,true);
  assert.ok(config.files.includes('!**/credentials.json'));
  assert.ok(config.files.includes('!**/state.json'));
  assert.ok(config.files.includes('!**/.env.*'));
  assert.ok(config.files.includes('!**/*.bak'));
  assert.ok(config.files.includes('!**/*.test.cjs'));
  assert.ok(config.files.includes('!**/*.gguf'));
  assert.deepEqual(config.extraResources.filter(x=>x.to==='llm').length,1);
  assert.ok(!config.extraResources.find(x=>x.to==='llm').filter.some(x=>x.includes('models')));
  assert.ok(config.extraResources.find(x=>x.to==='llm').filter.includes('licenses/**/*'));
});
test('17.5: rejects app identity change',t=>{
  const name=setup(t,b=>{delete b.appId;});
  assert.throws(()=>require(name),/appId/);
});
test('17.5: rejects data deletion on uninstall',t=>{
  const name=setup(t,b=>{b.nsis.deleteAppDataOnUninstall=true;});
  assert.throws(()=>require(name),/usuwa userData/);
});
test('17.5: rejects external publish destination',t=>{
  const name=setup(t,b=>{b.publish=[{provider:'github',owner:'other',repo:'untrusted'}];});
  assert.throws(()=>require(name),/inny kanał/);
});
test('17.5: rejects data/secret mappings',t=>{
  const name=setup(t,b=>{b.extraResources.push({from:'private/postgres17/data',to:'backup'});});
  assert.throws(()=>require(name),/prywatne dane/);
});
test('17.5: rejects custom NSIS script without review',t=>{
  const name=setup(t,b=>{b.nsis.script='custom.nsi';});
  assert.throws(()=>require(name),/przeglądu/);
});
