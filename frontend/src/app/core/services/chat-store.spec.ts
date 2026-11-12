import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatApiError, ChatApiService, ApiConversation, ApiMessage } from './chat-api';
import { ChatStore } from './chat-store';

const conversation = (id: string): ApiConversation => ({
  id, title: 'Nowa rozmowa', createdAt: '2026-11-09T12:00:00Z', updatedAt: '2026-11-09T12:00:00Z',
});
const message = (id: string, chat: string, role: 'USER'|'ASSISTANT', content: string): ApiMessage => ({
  id, conversationId: chat, role, content, createdAt: '2026-11-09T12:01:00Z', order: role === 'USER' ? 1 : 2,
});

describe('ChatStore — PostgreSQL is the source of truth', () => {
  const api = {
    list: vi.fn(), create: vi.fn(), get: vi.fn(), messages: vi.fn(), send: vi.fn(), delete: vi.fn(),
  };
  beforeEach(() => {
    vi.resetAllMocks();
    api.list.mockResolvedValue([]);
    api.messages.mockResolvedValue([]);
    api.create.mockResolvedValue(conversation('chat-1'));
    api.send.mockResolvedValue({
      userMessage: message('msg-u', 'chat-1', 'USER', 'Witaj'),
      assistantMessage: message('msg-a', 'chat-1', 'ASSISTANT', 'Cześć'),
    });
    api.delete.mockResolvedValue(undefined);
    TestBed.configureTestingModule({ providers: [{ provide: ChatApiService, useValue: api }] });
  });
  it('loads remote conversations without writing to localStorage', async () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem');
    api.list.mockResolvedValue([conversation('chat-1')]);
    const store = TestBed.inject(ChatStore);
    await vi.waitFor(() => expect(store.loading()).toBe(false));
    expect(store.activeId()).toBe('chat-1');
    expect(store.conversations()).toHaveLength(1);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
  it('creates and sends a pair of messages from the backend', async () => {
    const store = TestBed.inject(ChatStore);
    await vi.waitFor(() => expect(store.loading()).toBe(false));
    expect(await store.sendMessage('Witaj')).toBe(true);
    expect(api.create).toHaveBeenCalledTimes(1);
    expect(api.send).toHaveBeenCalledWith('chat-1', 'Witaj');
    expect(store.messages()).toEqual([
      { id: 'msg-u', role: 'user', content: 'Witaj' },
      { id: 'msg-a', role: 'assistant', content: 'Cześć' },
    ]);
  });
  it('rejects blank messages without calling backend', async () => {
    const store = TestBed.inject(ChatStore);
    await vi.waitFor(() => expect(store.loading()).toBe(false));
    expect(await store.sendMessage('  ')).toBe(false);
    expect(api.send).not.toHaveBeenCalled();
  });
  it('does not manufacture a successful assistant reply after backend failure', async () => {
    api.list.mockResolvedValue([conversation('chat-1')]);
    api.send.mockRejectedValue(new ChatApiError(500, 'GENERATION_FAILED'));
    const store = TestBed.inject(ChatStore);
    await vi.waitFor(() => expect(store.loading()).toBe(false));
    expect(await store.sendMessage('Witaj')).toBe(false);
    expect(store.messages()).toHaveLength(0);
    expect(store.saveError()).toBe(true);
  });
  it('shows an actionable error when Qwen is not running', async () => {
    api.list.mockResolvedValue([conversation('chat-1')]);
    api.send.mockRejectedValue(new ChatApiError(503, 'LLM_NOT_READY'));
    const store = TestBed.inject(ChatStore);
    await vi.waitFor(() => expect(store.loading()).toBe(false));
    expect(await store.sendMessage('Cześć')).toBe(false);
    expect(store.errorKey()).toBe('chat.llmUnavailable');
    expect(store.messages()).toHaveLength(0);
  });
  it('preserves failed POST state and warns about uncertain delivery', async () => {
    api.list.mockResolvedValue([conversation('chat-1')]);
    api.send.mockRejectedValue(new ChatApiError(0, 'BACKEND_UNAVAILABLE'));
    const store = TestBed.inject(ChatStore);
    await vi.waitFor(() => expect(store.loading()).toBe(false));
    expect(await store.sendMessage('Do not duplicate')).toBe(false);
    expect(api.send).toHaveBeenCalledTimes(1);
    expect(store.messages()).toHaveLength(0);
    expect(store.errorKey()).toBe('chat.deliveryUncertain');
  });
  it('deletes a chat only after backend confirmation', async () => {
    api.list.mockResolvedValue([conversation('chat-1')]);
    const store = TestBed.inject(ChatStore);
    await vi.waitFor(() => expect(store.loading()).toBe(false));
    expect(await store.removeActiveChat()).toBe(true);
    expect(api.delete).toHaveBeenCalledWith('chat-1');
    expect(store.activeId()).toBe('');
  });
  it('reports missing desktop bridge instead of silently using localStorage', async () => {
    api.list.mockRejectedValue(new ChatApiError(0, 'DESKTOP_BRIDGE_UNAVAILABLE'));
    const store = TestBed.inject(ChatStore);
    await vi.waitFor(() => expect(store.loading()).toBe(false));
    expect(store.connected()).toBe(false);
    expect(store.errorKey()).toBe('chat.backendUnavailable');
  });
});

describe('18.9 — stale chat requests', () => {
  it('aborts previous message GET when selecting another conversation', async () => {
    const calls: AbortSignal[] = [];
    const api = {
      list: vi.fn().mockResolvedValue([conversation('one'), conversation('two')]),
      messages: vi.fn().mockImplementation((_id: string, signal: AbortSignal) => {
        calls.push(signal);
        return Promise.resolve([]);
      }),
      create: vi.fn(), send: vi.fn(), delete: vi.fn(), get: vi.fn(), rename: vi.fn(),
    };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [{ provide: ChatApiService, useValue: api }] });
    const store = TestBed.inject(ChatStore);
    await vi.waitFor(() => expect(store.loading()).toBe(false));
    store.selectChat('two');
    store.selectChat('one');
    expect(calls).toHaveLength(3);
    expect(calls[1].aborted).toBe(true);
    expect(calls[2].aborted).toBe(false);
    await Promise.resolve();
  });
});
