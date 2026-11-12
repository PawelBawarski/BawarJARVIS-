import { afterEach, describe, expect, it, vi } from 'vitest';
import { BrowserApiError, browserApi, browserApiErrorKey } from './browser-api';

const success = (value: unknown) => ({ ok: true, status: 200, json: async () => value });
const failure = (status: number, code?: string) => ({
  ok: false, status, json: async () => code ? { code } : {},
});

describe('18.9 — browser API resilience', () => {
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it('retries transient GET failures with a strict limit', async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new TypeError('network offline'))
      .mockResolvedValueOnce(failure(502))
      .mockResolvedValueOnce(success(['ready']));
    vi.stubGlobal('fetch', fetchMock);
    await expect(browserApi('GET', '/api/chats', undefined, { retryDelayMs: 0 }))
      .resolves.toEqual(['ready']);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('never retries POST, even if requested and network response is lost', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('network lost'));
    vi.stubGlobal('fetch', fetchMock);
    await expect(browserApi('POST', '/api/chats/1/messages', { content: 'hi' }, {
      retries: 2, retryDelayMs: 0,
    })).rejects.toEqual(new BrowserApiError(0, 'BACKEND_UNAVAILABLE'));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not retry authentication errors or LLM_NOT_READY', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(failure(401, 'UNAUTHORIZED'))
      .mockResolvedValueOnce(failure(503, 'LLM_NOT_READY'));
    vi.stubGlobal('fetch', fetchMock);
    await expect(browserApi('GET', '/api/chats', undefined, { retryDelayMs: 0 }))
      .rejects.toMatchObject({ status: 401 });
    await expect(browserApi('GET', '/api/chats/model-status', undefined, { retryDelayMs: 0 }))
      .rejects.toEqual(new BrowserApiError(503, 'LLM_NOT_READY'));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not amplify HTTP 429 rate limits', async () => {
    const fetchMock = vi.fn().mockResolvedValue(failure(429, 'RATE_LIMITED'));
    vi.stubGlobal('fetch', fetchMock);
    await expect(browserApi('GET', '/api/chats', undefined, { retryDelayMs: 0 }))
      .rejects.toMatchObject({status: 429});
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('stops before making a request when aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(browserApi('GET', '/api/chats', undefined, { signal: controller.signal }))
      .rejects.toEqual(new BrowserApiError(0, 'REQUEST_CANCELLED'));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('aborts promptly while waiting to retry and never sends another request', async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('disconnected'));
    vi.stubGlobal('fetch', fetchMock);
    const job = browserApi('GET', '/api/chats', undefined, {
      signal: controller.signal, retryDelayMs: 200,
    });
    // Let the failed fetch settle and the backoff timer register.
    await Promise.resolve();
    controller.abort();
    await expect(job).rejects.toEqual(new BrowserApiError(0, 'REQUEST_CANCELLED'));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('reports a malformed success payload, without returning an undefined object', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, status: 200, json: async () => { throw new SyntaxError(); },
    }));
    await expect(browserApi('GET', '/api/chats', undefined, {retryDelayMs:0}))
      .rejects.toEqual(new BrowserApiError(200, 'INVALID_API_RESPONSE'));
  });

  it('maps machine errors to translated UI keys', () => {
    expect(browserApiErrorKey(new BrowserApiError(0, 'BACKEND_UNAVAILABLE'))).toBe('api.error.unavailable');
    expect(browserApiErrorKey(new BrowserApiError(429, 'HTTP_429'))).toBe('api.error.rateLimited');
    expect(browserApiErrorKey(new BrowserApiError(503, 'LLM_NOT_READY'))).toBe('chat.llmUnavailable');
    expect(browserApiErrorKey(new Error('not from API'))).toBeNull();
  });
});
