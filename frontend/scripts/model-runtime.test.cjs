"use strict";
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { modelConfig, llamaArgs, readModelSettings, waitForModelReady, ensurePortFree } = require('./model-runtime.cjs');

test('rejects missing executable and GGUF rather than silently using a remote endpoint', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-ai-'));
  try {
    assert.throws(() => modelConfig({}, temp), /pelne sciezki/);
    assert.throws(() => modelConfig({JARVIS_LLAMA_SERVER_PATH:process.platform === 'win32' ? 'C:/nonexistent/llama-server.exe' : '/nonexistent/llama-server', JARVIS_GGUF_PATH:'/nonexistent/a.gguf'}, temp), /Nie znaleziono/);
  } finally { fs.rmSync(temp, {recursive:true, force:true}); }
});

test('constructs loopback-only and offline llama.cpp arguments', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-ai-'));
  try {
    const exe = path.join(temp, process.platform === 'win32' ? 'llama-server.exe' : 'llama-server');
    const model = path.join(temp, 'Qwen3.gguf');
    fs.writeFileSync(exe, 'dummy'); fs.writeFileSync(model, 'dummy');
    const config = modelConfig({
      JARVIS_LLAMA_SERVER_PATH:exe, JARVIS_GGUF_PATH:model,
      JARVIS_GPU_LAYERS:'22', JARVIS_CTX_SIZE:'4096',
    }, temp);
    const args = llamaArgs(config);
    assert.deepEqual(args.slice(args.indexOf('--host'), args.indexOf('--host')+2), ['--host','127.0.0.1']);
    assert.deepEqual(args.slice(args.indexOf('--port'), args.indexOf('--port')+2), ['--port','8765']);
    assert.deepEqual(args.slice(args.indexOf('--alias'), args.indexOf('--alias')+2), ['--alias','jarvis-qwen3-8b']);
    assert.ok(args.includes('--offline'));
    assert.ok(args.includes('--no-webui'));
    assert.ok(!args.includes('--api-key'), 'secret must not be passed in CLI args');
  } finally { fs.rmSync(temp, {recursive:true, force:true}); }
});

test('reads local paths and refuses unsupported settings in model config file', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-ai-'));
  try {
    const file = path.join(temp, '.env.model.local');
    fs.writeFileSync(file, '# paths\nJARVIS_CTX_SIZE=2048\n');
    assert.deepEqual(readModelSettings(file), { JARVIS_CTX_SIZE:'2048' });
    fs.writeFileSync(file, 'LLAMA_API_KEY=secret\n');
    assert.throws(() => readModelSettings(file), /Nieprawidlowe/);
  } finally { fs.rmSync(temp, {recursive:true, force:true}); }
});

test('waits for loading (503), then checks model alias and bearer authentication', async () => {
  const urls = [];
  let count = 0;
  const fetchImpl = async (url, options = {}) => {
    urls.push([url, options]);
    if (url.endsWith('/health')) return { status: ++count === 1 ? 503 : 200 };
    assert.equal(options.headers.Authorization, 'Bearer dev-secret');
    return {ok:true, json: async()=>({data:[{id:'jarvis-qwen3-8b'}]})};
  };
  await waitForModelReady({apiKey:'dev-secret', timeoutMs:5000, intervalMs:0, fetchImpl, sleep:async()=>{}});
  assert.equal(urls.length,3);
});

test('rejects a different model or failed authentication', async () => {
  await assert.rejects(() => waitForModelReady({apiKey:'a', timeoutMs:50,
    fetchImpl: async url => url.endsWith('/health') ? {status:200} :
      {ok:true, json:async()=>({data:[{id:'foreign-model'}]})},
  }), /inny model/);
  await assert.rejects(() => waitForModelReady({apiKey:'a', timeoutMs:50,
    fetchImpl: async url => url.endsWith('/health') ? {status:200} : {ok:false,status:401},
  }), /autoryzacji/);
});

test('refuses to bind to a port already in use', async () => {
  const net = require('node:net');
  const server = net.createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try { await assert.rejects(ensurePortFree(server.address().port), /zajety/); }
  finally { await new Promise(resolve => server.close(resolve)); }
});
