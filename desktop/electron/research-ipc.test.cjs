const test=require('node:test');
const assert=require('node:assert/strict');
const {routeResearch,performResearch,registerResearchIpc,allowedSourceUrl}=require('./research-ipc.cjs');
const TOKEN='a'.repeat(64);
test('only fixed paths with validated inputs',()=>{
  assert.deepEqual(routeResearch({operation:'list'}),{method:'GET',path:'/api/research'});
  assert.throws(()=>routeResearch({operation:'save',title:'x',language:'evil.com'}));
  assert.throws(()=>routeResearch({operation:'delete',id:'../../../private'}));
  assert.throws(()=>routeResearch({operation:'fetch',url:'http://127.0.0.1'}));
});
test('backend token does not reach UI and POST is fixed',async()=>{
  let called;
  const fn=async(url,options)=>{called={url,options};return {ok:true,status:200,headers:{get:()=> 'application/json'},json:async()=>[]};};
  const res=await performResearch({operation:'search',query:'Angular',language:'pl'},TOKEN,fn);
  assert.equal(res.ok,true);
  assert.equal(called.url,'http://127.0.0.1:8080/api/research/search');
  assert.equal(called.options.headers['X-Jarvis-Session'],TOKEN);
});
test('rejects untrusted renderer',async()=>{
  let handler;registerResearchIpc({handle:(_,callback)=>{handler=callback;}},()=>false,()=>TOKEN);
  await assert.rejects(()=>handler({}, {operation:'list'}),/Untrusted/);
});
test('only public wikipedia article URLs can be opened',()=>{
  assert.equal(allowedSourceUrl('https://pl.wikipedia.org/wiki/Angular'), 'https://pl.wikipedia.org/wiki/Angular');
  assert.throws(()=>allowedSourceUrl('http://127.0.0.1/wiki/foo'));
  assert.throws(()=>allowedSourceUrl('https://pl.wikipedia.org.evil.test/wiki/a'));
});
