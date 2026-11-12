import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatApiError, ChatApiService, ChatApiResult } from './chat-api';

describe('ChatApiService (IPC and browser REST)', () => {
  const previous = window.jarvisDesktop;
  beforeEach(() => TestBed.configureTestingModule({}));
  afterEach(() => { window.jarvisDesktop = previous; vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it('uses same-origin REST without exposing an auth header in browser', async () => {
    window.jarvisDesktop = undefined;
    const fetchMock = vi.fn().mockResolvedValue({ok:true,status:200,json:async()=>[]});
    vi.stubGlobal('fetch', fetchMock);
    await expect(TestBed.inject(ChatApiService).list()).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenCalledWith('/api/chats', {
      method: 'GET', credentials: 'same-origin',
    });
  });

  it('sends message JSON to the matching Spring Boot endpoint', async () => {
    window.jarvisDesktop = undefined;
    const fetchMock = vi.fn().mockResolvedValue({ok:true,status:200,json:async()=>({userMessage:{},assistantMessage:{}})});
    vi.stubGlobal('fetch', fetchMock);
    await TestBed.inject(ChatApiService).send('123', 'Cześć');
    expect(fetchMock).toHaveBeenCalledWith('/api/chats/123/messages', {
      method:'POST', credentials:'same-origin',
      headers:{'Content-Type':'application/json'}, body: JSON.stringify({content:'Cześć'}),
    });
  });

  it('reads readiness through same-origin authenticated proxy', async () => {
    window.jarvisDesktop = undefined;
    const fetchMock = vi.fn().mockResolvedValue({ok:true,status:200,json:async()=>({model:'jarvis-qwen3-8b',ready:true})});
    vi.stubGlobal('fetch', fetchMock);
    await expect(TestBed.inject(ChatApiService).modelStatus()).resolves.toEqual({model:'jarvis-qwen3-8b',ready:true});
    expect(fetchMock).toHaveBeenCalledWith('/api/chats/model-status', {method:'GET',credentials:'same-origin'});
  });

  it('uses IPC when a legacy bridge is supplied', async () => {
    const chatApi = vi.fn(async () => ({ ok: true, status: 200, data: [] }) as ChatApiResult);
    window.jarvisDesktop = { ...previous!, checkPrivateHealth: async () => ({ status: 'unavailable' }), chatApi };
    await expect(TestBed.inject(ChatApiService).list()).resolves.toEqual([]);
    expect(chatApi).toHaveBeenCalledWith({ operation: 'list' });
  });

  it('returns HTTP auth errors with status', async () => {
    window.jarvisDesktop = undefined;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ok:false,status:401,json:async()=>({error:'UNAUTHORIZED'})}));
    await expect(TestBed.inject(ChatApiService).list()).rejects.toMatchObject({status:401});
  });

  it('maps backend offline to status zero', async () => {
    window.jarvisDesktop = undefined;
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('fetch failed')));
    await expect(TestBed.inject(ChatApiService).list()).rejects.toMatchObject({status:0});
  });
});
