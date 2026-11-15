import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ChatApiService } from './chat-api';

describe('Native Chat SSE', () => {
  afterEach(() => { vi.unstubAllGlobals(); window.jarvisDesktop = undefined; });
  it('decodes fragmented SSE frames without duplicating text', async () => {
    window.jarvisDesktop = undefined;
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('event: delta\ndata: "Pier'));
        controller.enqueue(encoder.encode('wsza "\n\nevent: delta\ndata: "druga"\n\n'));
        controller.enqueue(encoder.encode('event: done\ndata: {"userMessage":{"id":"1"},"assistantMessage":{"id":"2"}}\n\n'));
        controller.close();
      },
    });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, body: stream });
    vi.stubGlobal('fetch', fetchMock);
    const api = TestBed.inject(ChatApiService);
    const chunks: string[] = [];
    const turn = await api.sendStream('c1', 'pytanie', 'd1', text => chunks.push(text), new AbortController().signal);
    expect(chunks).toEqual(['Pierwsza ', 'druga']);
    expect(turn?.assistantMessage.id).toBe('2');
    expect(fetchMock).toHaveBeenCalledWith('/api/chats/c1/messages/stream?requestId=d1',
      expect.objectContaining({ method: 'POST', credentials: 'same-origin' }));
  });
  it('sends explicit server cancellation without access to a secret', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ok:true,status:204});
    vi.stubGlobal('fetch', fetchMock);
    await TestBed.inject(ChatApiService).cancelStream('c1', 'd1');
    expect(fetchMock).toHaveBeenCalledWith('/api/chats/c1/messages/stream/cancel?requestId=d1',
      {method:'POST', credentials:'same-origin'});
  });
});
