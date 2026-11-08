import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { ChatStore } from './chat-store';

describe('ChatStore', () => {
  beforeEach(() => {
    window.localStorage.removeItem('jarvis.chats.v1');
    TestBed.configureTestingModule({});
  });

  it('should create an initial empty chat', () => {
    const store = TestBed.inject(ChatStore);

    expect(store.conversations()).toHaveLength(1);
    expect(store.messages()).toHaveLength(0);
  });

  it('should create a second chat', () => {
    const store = TestBed.inject(ChatStore);

    const firstId = store.activeId();

    store.newChat();

    expect(store.conversations()).toHaveLength(2);
    expect(store.activeId()).not.toBe(firstId);
  });

  it('should isolate messages between chats', () => {
    const store = TestBed.inject(ChatStore);

    store.addUserMessage('Pierwszy czat');
    const firstId = store.activeId();

    store.newChat();
    store.addUserMessage('Drugi czat');

    expect(store.messages()[0].content).toBe('Drugi czat');

    store.selectChat(firstId);

    expect(store.messages()[0].content).toBe('Pierwszy czat');
  });

  it('should reject empty messages', () => {
    const store = TestBed.inject(ChatStore);

    expect(store.addUserMessage('   ')).toBe(false);
    expect(store.messages()).toHaveLength(0);
  });

  it('should delete active chat', () => {
    const store = TestBed.inject(ChatStore);
    const firstId = store.activeId();

    store.newChat();
    store.deleteActiveChat();

    expect(store.conversations()).toHaveLength(1);
    expect(store.activeId()).toBe(firstId);
  });

  it('should leave one empty chat after deleting last', () => {
    const store = TestBed.inject(ChatStore);

    store.addUserMessage('Wiadomość');
    store.deleteActiveChat();

    expect(store.conversations()).toHaveLength(1);
    expect(store.messages()).toHaveLength(0);
  });

  it('should restore saved conversations', () => {
    const store = TestBed.inject(ChatStore);

    store.addUserMessage('Zapamiętaj rozmowę');

    const restored = TestBed.runInInjectionContext(() => new ChatStore());

    expect(restored.messages()[0].content).toBe('Zapamiętaj rozmowę');

    expect(restored.activeId()).toBe(store.activeId());
  });
});
