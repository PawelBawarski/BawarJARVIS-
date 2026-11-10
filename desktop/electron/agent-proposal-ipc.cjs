'use strict';

/** Fixed allowlisted routes; never accepts a URL or shell command from the renderer. */
const BASE = 'http://127.0.0.1:8080';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN = /^[0-9a-f]{64}$/;

const CODE_EXT = /\.(?:java|ts|tsx|js|cjs|html|scss|css|json|sql|xml|md|yml|yaml|properties)$/i;
const SECRET_NAME = /(?:^|[._-])(?:secret|password|credential|private|token|api.?key|keystore|id_rsa|id_ed25519)(?:[._-]|$)/i;
const DENIED_DIR = new Set(['node_modules', 'target', 'dist', 'build', '.git', '.ssh', '.aws', 'appdata', 'windows', 'system32', 'coverage', '.angular', 'venv']);
function validSourcePath(p) {
  if (typeof p !== 'string' || !p || p.length > 240 || p.includes('\\') || p.includes(':') || p.startsWith('/') || p.includes('//')) return false;
  const segments = p.split('/');
  return segments.length <= 12 && CODE_EXT.test(segments.at(-1)) && segments.every(segment =>
    /^[A-Za-z0-9_-][A-Za-z0-9._-]{0,79}$/.test(segment) &&
    !segment.startsWith('.') && !DENIED_DIR.has(segment.toLowerCase()) && !SECRET_NAME.test(segment));
}
function validateAgentSources(sources) {
  if (!Array.isArray(sources) || sources.length > 3) throw new Error('Invalid source count');
  let total = 0;
  const seen = new Set();
  return sources.map(source => {
    if (!source || typeof source !== 'object' || Array.isArray(source) ||
        Object.keys(source).some(k => !['relativePath', 'content'].includes(k)) ||
        !validSourcePath(source.relativePath) || seen.has(source.relativePath) ||
        typeof source.content !== 'string' || !source.content.trim() ||
        source.content.length > 3600 || source.content.includes('\0')) {
      throw new Error('Invalid source excerpt');
    }
    seen.add(source.relativePath);
    total += source.content.length;
    if (total > 8000) throw new Error('Source context exceeds limit');
    return { relativePath: source.relativePath, content: source.content };
  });
}

function routeAgent(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid request');
  const { operation, id } = input;
  if (['decide', 'revise'].includes(operation) && (typeof id !== 'string' || !UUID.test(id))) {
    throw new Error('Invalid proposal ID');
  }
  switch (operation) {
    case 'list': return { method: 'GET', path: '/api/agent/proposals' };
    case 'generate': {
      if (typeof input.task !== 'string' || !input.task.trim() || input.task.length > 1200) {
        throw new Error('Invalid task');
      }
      const body = { task: input.task.trim() };
      if (input.sources !== undefined) {
        body.sources = validateAgentSources(input.sources);
      }
      return { method: 'POST', path: '/api/agent/proposals', body };
    }
    case 'patch-preview': {
      if (typeof input.task !== 'string' || !input.task.trim() || input.task.length > 1200) {
        throw new Error('Invalid patch preview task');
      }
      const [source] = validateAgentSources([input.source]);
      return { method: 'POST', path: '/api/agent/patch-preview', body: { task: input.task.trim(), source } };
    }
    case 'decide': {
      if (!['APPROVED', 'REJECTED'].includes(input.decision)) throw new Error('Invalid decision');
      return { method: 'POST', path: `/api/agent/proposals/${id}/decision`, body: { decision: input.decision } };
    }
    case 'revise': {
      if (typeof input.feedback !== 'string' || !input.feedback.trim() || input.feedback.length > 1200) {
        throw new Error('Invalid revision feedback');
      }
      return { method: 'POST', path: `/api/agent/proposals/${id}/revise`, body: { feedback: input.feedback.trim() } };
    }
    default: throw new Error('Unsupported agent operation');
  }
}

async function performAgentRequest(input, token, fetchImpl = fetch) {
  const route = routeAgent(input);
  if (typeof token !== 'string' || !TOKEN.test(token)) {
    return { ok: false, status: 401, error: 'SESSION_NOT_CONFIGURED' };
  }
  try {
    const response = await fetchImpl(BASE + route.path, {
      method: route.method,
      headers: {
        'X-Jarvis-Session': token,
        ...(route.body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(route.body ? { body: JSON.stringify(route.body) } : {}),
      redirect: 'error',
      signal: AbortSignal.timeout(route.method === 'GET' ? 7000 : 180000),
    });
    const contentType = response.headers?.get?.('content-type') || '';
    if (!contentType.toLowerCase().includes('application/json')) {
      return { ok: false, status: response.status, error: 'INVALID_SERVER_RESPONSE' };
    }
    const data = await response.json();
    if (!response.ok) {
      return { ok: false, status: response.status, error: data?.code || 'REQUEST_FAILED' };
    }
    return { ok: true, status: response.status, data };
  } catch {
    return { ok: false, status: 0, error: 'AGENT_BACKEND_UNAVAILABLE' };
  }
}

function registerAgentIpc(ipcMain, trustedSender, tokenSource = () => process.env.JARVIS_SESSION_TOKEN) {
  ipcMain.handle('jarvis:agent-proposal-api', async (event, request) => {
    if (!trustedSender(event)) throw new Error('Untrusted IPC sender');
    return performAgentRequest(request, tokenSource());
  });
}

module.exports = { routeAgent, performAgentRequest, registerAgentIpc, validateAgentSources, validSourcePath };
