import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatApiError, ChatApiService } from './chat-api';

describe('M04.6 - Chat API error contract', () => {
  const originalDesktop = window.jarvisDesktop;

  beforeEach(() => {
    window.jarvisDesktop = undefined;
    TestBed.configureTestingModule({});
  });

  afterEach(() => {
    window.jarvisDesktop = originalDesktop;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    TestBed.resetTestingModule();
  });

  it('normalizes unexpected browser failures to status 0', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() => {
        throw new Error('PRIVATE_NETWORK_DETAILS');
      }),
    );

    await expect(TestBed.inject(ChatApiService).list()).rejects.toMatchObject({
      name: 'ChatApiError',
      status: 0,
      message: 'BACKEND_UNAVAILABLE',
    });
  });

  it('does not expose IPC exception details', async () => {
    window.jarvisDesktop = {
      ...originalDesktop!,
      checkPrivateHealth: async () => ({ status: 'unavailable' }),
      chatApi: vi.fn().mockRejectedValue(new Error('PRIVATE_IPC_DETAILS')),
    };

    await expect(TestBed.inject(ChatApiService).list()).rejects.toMatchObject({
      status: 0,
      message: 'BACKEND_UNAVAILABLE',
    });
  });

  it('keeps the status returned by the Electron bridge', async () => {
    window.jarvisDesktop = {
      ...originalDesktop!,
      checkPrivateHealth: async () => ({ status: 'unavailable' }),
      chatApi: vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        error: 'UNAUTHORIZED',
      }),
    };

    await expect(TestBed.inject(ChatApiService).list()).rejects.toMatchObject({
      status: 401,
    });
  });

  it('sends the correct title payload when renaming', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        id: 'chat-1',
        title: 'Nowa nazwa',
        createdAt: '2026-11-14T12:00:00Z',
        updatedAt: '2026-11-14T12:00:00Z',
      }),
    });

    vi.stubGlobal('fetch', fetchMock);

    await TestBed.inject(ChatApiService).rename('chat-1', 'Nowa nazwa');

    expect(fetchMock).toHaveBeenCalledWith('/api/chats/chat-1', {
      method: 'PATCH',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Nowa nazwa' }),
    });
  });

  it('uses ChatApiError as a typed error contract', () => {
    const error = new ChatApiError(404, 'NOT_FOUND');

    expect(error).toBeInstanceOf(Error);
    expect(error.status).toBe(404);
    expect(error.name).toBe('ChatApiError');
  });
});
