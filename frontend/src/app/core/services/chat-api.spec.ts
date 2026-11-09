import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatApiError, ChatApiService, ChatApiResult } from './chat-api';

describe('ChatApiService (IPC only)', () => {
  const previous = window.jarvisDesktop;
  beforeEach(() => TestBed.configureTestingModule({}));
  afterEach(() => { window.jarvisDesktop = previous; vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it('never issues unauthenticated browser fetch requests', async () => {
    window.jarvisDesktop = undefined;
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(TestBed.inject(ChatApiService).list())
      .rejects.toBeInstanceOf(ChatApiError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends only operation and payload through IPC', async () => {
    const chatApi = vi.fn(async () => ({ ok: true, status: 200, data: [] }) as ChatApiResult);
    window.jarvisDesktop = { ...previous!, checkPrivateHealth: async () => ({ status: 'unavailable' }), chatApi };
    await expect(TestBed.inject(ChatApiService).list()).resolves.toEqual([]);
    expect(chatApi).toHaveBeenCalledWith({ operation: 'list' });
  });

  it('propagates authorization failures with status', async () => {
    window.jarvisDesktop = { ...previous!, checkPrivateHealth: async () => ({ status: 'unavailable' }),
      chatApi: async () => ({ ok: false, status: 401, error: 'UNAUTHORIZED' }) };
    await expect(TestBed.inject(ChatApiService).list()).rejects.toMatchObject({ status: 401 });
  });
});
