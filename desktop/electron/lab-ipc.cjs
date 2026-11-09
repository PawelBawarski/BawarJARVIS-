'use strict';
// Fixed desktop-only API routes. No generic fetch, URLs, paths or tokens from renderer.
const BASE = 'http://127.0.0.1:8080';
const TOKEN = /^[0-9a-f]{64}$/;
const OPS = Object.freeze({
  state: ['GET', '/api/ai-lab/training'],
  model: ['GET', '/api/ai-lab/model'],
  train: ['POST', '/api/ai-lab/training'],
  evaluate: ['POST', '/api/ai-lab/evaluate'],
  save: ['POST', '/api/ai-lab/checkpoint/save'],
  load: ['POST', '/api/ai-lab/checkpoint/load'],
  historyRuns: ['GET', '/api/ai-lab/history/runs'],
  historyCheckpoints: ['GET', '/api/ai-lab/history/checkpoints'],
  historyEvaluations: ['GET', '/api/ai-lab/history/evaluations'],
  historyEpochs: ['GET', '/api/ai-lab/history/runs/:id/epochs'],
  datasetList: ['GET', '/api/ai-lab/datasets'],
  datasetCreate: ['POST', '/api/ai-lab/datasets'],
  datasetVersions: ['GET', '/api/ai-lab/datasets/:id/versions'],
  datasetRevise: ['POST', '/api/ai-lab/datasets/:id/versions'],
  datasetRead: ['GET', '/api/ai-lab/datasets/versions/:id'],
});
function validateExamples(examples) {
  if (!Array.isArray(examples) || examples.length < 1 || examples.length > 100 ||
      !examples.every(s => typeof s === 'string' && s.trim() && s.length <= 256)) {
    throw new Error('Invalid examples');
  }
  return examples;
}
function validateDatasetExamples(examples) {
  if (!Array.isArray(examples) || examples.length < 5 || examples.length > 100 ||
      examples.some(v => typeof v !== 'string' || !v.trim() || v.length > 256 || /[\x00-\x1f\x7f]/.test(v)) ||
      new Set(examples.map(v => v.trim())).size !== examples.length) {
    throw new Error('Invalid dataset examples');
  }
  return examples;
}
const DATASET_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function routeRequest(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
      !Object.prototype.hasOwnProperty.call(OPS, input.operation)) {
    throw new Error('Unsupported AI Lab operation');
  }
  if (Object.keys(input).some(key => !['operation','epochs','examples','id','name'].includes(key))) {
    throw new Error('Unexpected request fields');
  }
  const [method, path] = OPS[input.operation];
  if (input.operation === 'datasetList') {
    if (Object.keys(input).length !== 1) throw new Error('Unexpected dataset fields');
    return { method, path };
  }
  if (['datasetVersions', 'datasetRead', 'datasetRevise'].includes(input.operation)) {
    if (typeof input.id !== 'string' || !DATASET_ID.test(input.id)) throw new Error('Invalid dataset ID');
    const allowed = input.operation === 'datasetRevise' ? ['operation','id','examples'] : ['operation','id'];
    if (Object.keys(input).some(key => !allowed.includes(key))) throw new Error('Unexpected dataset fields');
    return { method, path: path.replace(':id', input.id.toLowerCase()),
      ...(input.operation === 'datasetRevise' ? { body: { examples: validateDatasetExamples(input.examples) } } : {}) };
  }
  if (input.operation === 'datasetCreate') {
    if (Object.keys(input).some(key => !['operation','name','examples'].includes(key)) ||
        typeof input.name !== 'string' || !input.name.trim() || input.name.trim().length > 80 ||
        /[\x00-\x1f\x7f]/.test(input.name)) throw new Error('Invalid dataset name');
    return { method, path, body: { name: input.name.trim(), examples: validateDatasetExamples(input.examples) } };
  }
  if (input.operation === 'historyEpochs') {
    if (Object.keys(input).some(key => !['operation','id'].includes(key))) throw new Error('Unexpected request fields');
    if (typeof input.id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.id)) {
      throw new Error('Invalid run ID');
    }
    return { method, path: path.replace(':id', input.id.toLowerCase()) };
  }
  if ('id' in input || 'name' in input) throw new Error('Unexpected request fields');
  if (input.operation === 'train') {
    if (!Number.isInteger(input.epochs) || input.epochs < 1 || input.epochs > 100) throw new Error('Invalid epochs');
    return { method, path, body: { epochs: input.epochs, examples: validateExamples(input.examples) } };
  }
  if (input.operation === 'evaluate') return { method, path, body: { examples: validateExamples(input.examples) } };
  if ('epochs' in input || 'examples' in input) throw new Error('Unexpected request fields');
  return { method, path };
}
async function performLabRequest(input, token, fetchImpl = fetch) {
  const route = routeRequest(input);
  if (typeof token !== 'string' || !TOKEN.test(token)) {
    return { ok: false, status: 401, error: 'SESSION_NOT_CONFIGURED' };
  }
  try {
    const response = await fetchImpl(BASE + route.path, {
      method: route.method,
      headers: { 'X-Jarvis-Session': token, ...(route.body ? { 'Content-Type': 'application/json' } : {}) },
      ...(route.body ? { body: JSON.stringify(route.body) } : {}),
      redirect: 'error',
      signal: AbortSignal.timeout(10000),
    });
    if (response.status === 204) return { ok: true, status: 204, data: null };
    if (!(response.headers?.get?.('content-type') || '').toLowerCase().includes('application/json')) {
      return { ok: false, status: response.status, error: 'INVALID_SERVER_RESPONSE' };
    }
    const data = await response.json();
    if (!response.ok) return { ok: false, status: response.status, error: data?.code || 'REQUEST_FAILED' };
    return { ok: true, status: response.status, data };
  } catch { return { ok: false, status: 0, error: 'BACKEND_UNAVAILABLE' }; }
}
function registerLabIpc(ipcMain, trustedSender, tokenSource = () => process.env.JARVIS_SESSION_TOKEN) {
  ipcMain.handle('jarvis:lab-api', async (event, request) => {
    if (!trustedSender(event)) throw new Error('Untrusted IPC sender');
    return performLabRequest(request, tokenSource());
  });
}
module.exports = { routeRequest, performLabRequest, registerLabIpc };
