'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { routeRequest, performLabRequest } = require('./lab-ipc.cjs');
const id = '123e4567-e89b-42d3-a456-426614174001';
const examples = ['ala','ma kota','kot lubi ryby','Java Spring','Angular'];

test('dataset routes are fixed, not renderer-controlled URLs', () => {
  assert.deepEqual(routeRequest({operation:'datasetList'}),
    {method:'GET',path:'/api/ai-lab/datasets'});
  assert.deepEqual(routeRequest({operation:'datasetVersions',id}),
    {method:'GET',path:`/api/ai-lab/datasets/${id}/versions`});
  assert.deepEqual(routeRequest({operation:'datasetRead',id}),
    {method:'GET',path:`/api/ai-lab/datasets/versions/${id}`});
});
test('creates and revises with bounded input only', () => {
  assert.deepEqual(routeRequest({operation:'datasetCreate',name:'Przykłady',examples}),
    {method:'POST',path:'/api/ai-lab/datasets',body:{name:'Przykłady',examples}});
  assert.deepEqual(routeRequest({operation:'datasetRevise',id,examples}),
    {method:'POST',path:`/api/ai-lab/datasets/${id}/versions`,body:{examples}});
});
test('rejects path traversal, arbitrary keys and urls', () => {
  assert.throws(() => routeRequest({operation:'datasetRead',id:'../foo'}));
  assert.throws(() => routeRequest({operation:'datasetVersions',id:'http://host/'}));
  assert.throws(() => routeRequest({operation:'datasetList',url:'https://example.com'}));
  assert.throws(() => routeRequest({operation:'datasetCreate',name:'x',examples,token:'secret'}));
});
test('rejects invalid example counts, duplicates and control characters', () => {
  assert.throws(() => routeRequest({operation:'datasetCreate',name:'x',examples:['a']}));
  assert.throws(() => routeRequest({operation:'datasetCreate',name:'x',examples:['a','b','c','d','a']}));
  assert.throws(() => routeRequest({operation:'datasetCreate',name:'x',examples:['a','b','c','d','\u0000']}));
  assert.throws(() => routeRequest({operation:'datasetCreate',name:'x'.repeat(81),examples}));
});
test('rejects request without the private session token', async () => {
  const result = await performLabRequest({operation:'datasetList'},'',async()=>{ throw Error('should not fetch') });
  assert.equal(result.status,401);
});
test('calls only loopback backend with session header', async () => {
  let uri = '', opts;
  const result = await performLabRequest({operation:'datasetList'},'a'.repeat(64),async (url, options) => {
    uri=url;opts=options;
    return {status:200,ok:true,headers:{get:()=> 'application/json'},json:async()=>[]};
  });
  assert.equal(result.ok,true);
  assert.equal(uri,'http://127.0.0.1:8080/api/ai-lab/datasets');
  assert.equal(opts.headers['X-Jarvis-Session'],'a'.repeat(64));
});
