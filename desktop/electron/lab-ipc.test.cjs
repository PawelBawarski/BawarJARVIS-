'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const { routeRequest, performLabRequest, registerLabIpc } = require('./lab-ipc.cjs');
const TOKEN = 'a'.repeat(64);
test('exact routes only', () => {
  assert.deepEqual(routeRequest({ operation: 'state' }), { method:'GET', path:'/api/ai-lab/training' });
  assert.deepEqual(routeRequest({ operation: 'save' }), { method:'POST', path:'/api/ai-lab/checkpoint/save' });
  assert.throws(() => routeRequest({ operation:'fetch', url:'https://example.org' }), /Unsupported/);
  assert.throws(() => routeRequest({ operation:'save', path:'C:\\' }), /Unexpected/);
});
test('rejects malformed training input', () => {
  assert.throws(() => routeRequest({operation:'train',epochs:0,examples:['abc']}), /epochs/);
  assert.throws(() => routeRequest({operation:'train',epochs:1,examples:[]}), /examples/);
  assert.throws(() => routeRequest({operation:'train',epochs:1,examples:['abc'],url:'http://localhost'}), /Unexpected/);
});
test('requires secret before network', async () => {
  let called = false;
  const result = await performLabRequest({operation:'state'}, '', async () => {called = true;});
  assert.equal(result.status,401);assert.equal(called,false);
});
test('token stays in main and request is fixed loopback', async () => {
  let observed;
  const result = await performLabRequest({operation:'train',epochs:2,examples:['aba']},TOKEN,async (url,opts)=>{
    observed={url,opts};return {ok:true,status:202,headers:{get:()=> 'application/json'},json:async()=>({status:'RUNNING'})};
  });
  assert.equal(result.ok,true);
  assert.equal(observed.url,'http://127.0.0.1:8080/api/ai-lab/training');
  assert.equal(observed.opts.headers['X-Jarvis-Session'],TOKEN);
  assert.deepEqual(JSON.parse(observed.opts.body),{epochs:2,examples:['aba']});
});
test('rejects untrusted sender',async()=>{
  let handler;
  registerLabIpc({handle:(_name,cb)=>handler=cb},()=>false,()=>TOKEN);
  await assert.rejects(()=>handler({}, {operation:'state'}),/Untrusted/);
});
test('backend offline returns structured result',async()=>{
  const value=await performLabRequest({operation:'state'},TOKEN,async()=>{throw Error('offline');});
  assert.equal(value.status,0);assert.equal(value.error,'BACKEND_UNAVAILABLE');
});
