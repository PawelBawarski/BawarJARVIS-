import { describe, expect, it } from 'vitest';
import { emptyChat, mapConversation, mapMessage } from './chat-mappers';

describe('M04 - pure chat DTO mappings', () => {
  it('maps user and assistant roles without altering message content', () => {
    const common = { id: 'm1', conversationId: 'c1', createdAt: '2026-11-14T12:00:00Z', order: 1 };
    expect(mapMessage({ ...common, role: 'USER', content: ' Cześć ' })).toEqual({
      id: 'm1', role: 'user', content: ' Cześć ',
    });
    expect(mapMessage({ ...common, role: 'ASSISTANT', content: 'Odpowiedź' }).role).toBe('assistant');
  });

  it('maps timestamps and initializes messages without mutating API response', () => {
    const api = {
      id: 'c1', title: 'Nowa rozmowa',
      createdAt: '2026-11-14T12:00:00Z', updatedAt: '2026-11-14T12:05:00Z',
    };
    const mapped = mapConversation(api);
    expect(mapped).toEqual({
      id: 'c1', title: 'Nowa rozmowa',
      createdAt: Date.parse(api.createdAt), updatedAt: Date.parse(api.updatedAt),
      messages: [],
    });
    expect(api).not.toHaveProperty('messages');
  });

  it('returns a new placeholder rather than shared mutable state', () => {
    expect(emptyChat()).toEqual({ id: '', title: '', createdAt: 0, updatedAt: 0, messages: [] });
    expect(emptyChat()).not.toBe(emptyChat());
  });
});
