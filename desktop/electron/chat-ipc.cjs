'use strict';

const BASE = 'http://127.0.0.1:8080';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN = /^[0-9a-f]{64}$/;

function routeRequest(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid chat request');
  const op = input.operation;
  const id = input.id;
  if (['get', 'messages', 'send', 'delete'].includes(op) && (typeof id !== 'string' || !UUID.test(id))) {
    throw new Error('Invalid conversation ID');
  }
  switch (op) {
    case 'list': return { method: 'GET', path: '/api/chats' };
    case 'create': {
      if (typeof input.title !== 'string' || !input.title.trim() || input.title.length > 200)
        throw new Error('Invalid title');
      return { method: 'POST', path: '/api/chats', body: { title: input.title.trim() } };
    }
    case 'get': return { method: 'GET', path: `/api/chats/${id}` };
    case 'messages': return { method: 'GET', path: `/api/chats/${id}/messages` };
    case 'send': {
      if (typeof input.content !== 'string' || !input.content.trim() || input.content.length > 4000)
        throw new Error('Invalid message');
      return { method: 'POST', path: `/api/chats/${id}/messages`, body: { content: input.content.trim() } };
    }
    case 'delete': return { method: 'DELETE', path: `/api/chats/${id}` };
    default: throw new Error('Unsupported operation');
  }
}

async function performChatRequest(input, token, fetchImpl = fetch) {
  const route = routeRequest(input);
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
      signal: AbortSignal.timeout(route.method === 'GET' ? 7000 : 45000),
    });
    if (response.status === 204) return { ok: true, status: 204, data: null };
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
    return { ok: false, status: 0, error: 'BACKEND_UNAVAILABLE' };
  }
}

function registerChatIpc(ipcMain, trustedSender, tokenSource = () => process.env.JARVIS_SESSION_TOKEN) {
  ipcMain.handle('jarvis:chat-api', async (event, request) => {
    if (!trustedSender(event)) throw new Error('Untrusted IPC sender');
    return performChatRequest(request, tokenSource());
  });
}

module.exports = { routeRequest, performChatRequest, registerChatIpc };
