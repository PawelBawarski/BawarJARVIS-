'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const {routeRequest, performLabRequest} = require('./lab-ipc.cjs');
const ID = '123e4567-e89b-42d3-a456-426614174000';
const TOKEN = 'e'.repeat(64);

test('only fixed history routes are supported', () => {
  assert.deepEqual(routeRequest({operation:'historyRuns'}), {method:'GET',path:'/api/ai-lab/history/runs'});
  assert.deepEqual(routeRequest({operation:'historyCheckpoints'}), {method:'GET',path:'/api/ai-lab/history/checkpoints'});
  assert.deepEqual(routeRequest({operation:'historyEvaluations'}), {method:'GET',path:'/api/ai-lab/history/evaluations'});
  assert.deepEqual(routeRequest({operation:'historyEpochs',id:ID}), {method:'GET',path:'/api/ai-lab/history/runs/'+ID+'/epochs'});
});
test('dynamic path parameter accepts only canonical UUID', () => {
  for (const id of ['../../etc/passwd','/api/chats','123',ID+'?other=1','',null,42])
    assert.throws(()=>routeRequest({operation:'historyEpochs',id}), /Invalid run ID/);
});
test('history routes refuse extra fields and arbitrary destinations', () => {
  assert.throws(()=>routeRequest({operation:'historyRuns',url:'https://evil.example'}), /Unexpected/);
  assert.throws(()=>routeRequest({operation:'historyCheckpoints',id:ID}), /Unexpected/);
  assert.throws(()=>routeRequest({operation:'historyEpochs',id:ID,examples:['x']}), /Unexpected/);
});
test('history request carries secret from main process only', async () => {
  let observed;
  const result=await performLabRequest({operation:'historyRuns'},TOKEN,async(url,opts)=>{
    observed={url,opts};return {ok:true,status:200,headers:{get:()=> 'application/json'},json:async()=>[]};
  });
  assert.equal(result.ok,true);
  assert.equal(observed.url,'http://127.0.0.1:8080/api/ai-lab/history/runs');
  assert.equal(observed.opts.headers['X-Jarvis-Session'],TOKEN);
  assert.equal(observed.opts.method,'GET');
});
