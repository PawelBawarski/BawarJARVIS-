import { afterEach, describe, expect, it, vi } from 'vitest';
import { BrowserApiError, browserApi } from './browser-api';
describe('browserApi', () => {
  afterEach(() => {vi.restoreAllMocks(); vi.unstubAllGlobals();});
  it('never accepts arbitrary origins', async () => {
    await expect(browserApi('GET', 'https://evil.test/api/chats')).rejects.toThrow('INVALID_API_ROUTE');
  });
  it('handles 204 responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ok:true,status:204}));
    await expect(browserApi('DELETE', '/api/chats/id')).resolves.toBeNull();
  });
  it('accepts Spring Boot ApiError.code for 503 model unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ok:false,status:503,json:async()=>({code:'LLM_NOT_READY',message:'Model unavailable'})}));
    await expect(browserApi('POST', '/api/chats/123/messages')).rejects.toEqual(new BrowserApiError(503,'LLM_NOT_READY'));
  });
  it('preserves HTTP status and validated machine error code', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ok:false,status:503,json:async()=>({error:'LLM_NOT_READY'})}));
    await expect(browserApi('GET', '/api/ai-lab/model')).rejects.toEqual(new BrowserApiError(503,'LLM_NOT_READY'));
  });
});
