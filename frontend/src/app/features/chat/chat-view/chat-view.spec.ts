import { TestBed } from '@angular/core/testing';

import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

import { ChatView } from './chat-view';

import { ChatStore } from '../../../core/services/chat-store';
import { TranslationService } from '../../../core/services/translation';

describe('ChatView', () => {
  beforeEach(() => {
    localStorage.removeItem('jarvis.chats.v1');

    TestBed.configureTestingModule({
      providers: [
        {
          provide: TranslationService,
          useValue: {
            translate: (key: string) => key,
          },
        },
      ],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should start with an empty conversation', () => {
    const fixture = TestBed.createComponent(ChatView);

    expect(fixture.componentInstance.store.messages()).toHaveLength(0);
  });

  it('should save user message without fake AI response', () => {
    const fixture = TestBed.createComponent(ChatView);

    const component = fixture.componentInstance;

    component.draft.set('Cześć Jarvis');
    component.sendMessage();

    expect(component.store.messages()).toHaveLength(1);

    expect(component.store.messages()[0].role).toBe('user');

    expect(component.store.messages()[0].content).toBe('Cześć Jarvis');

    expect(component.draft()).toBe('');
  });

  it('should create a new conversation', () => {
    const fixture = TestBed.createComponent(ChatView);

    const component = fixture.componentInstance;

    component.sendMessage();
    component.newChat();

    expect(component.store.conversations()).toHaveLength(2);
    expect(component.store.messages()).toHaveLength(0);
  });

  it('should not delete chat without confirmation', () => {
    const fixture = TestBed.createComponent(ChatView);
    const store = TestBed.inject(ChatStore);

    vi.spyOn(window, 'confirm').mockReturnValue(false);

    store.addUserMessage('Zachowaj mnie');

    fixture.componentInstance.deleteChat();

    expect(store.messages()).toHaveLength(1);
  });

  it('should delete chat after confirmation', () => {
    const fixture = TestBed.createComponent(ChatView);
    const store = TestBed.inject(ChatStore);

    vi.spyOn(window, 'confirm').mockReturnValue(true);

    store.addUserMessage('Usuń mnie');

    fixture.componentInstance.deleteChat();

    expect(store.messages()).toHaveLength(0);
    expect(store.conversations()).toHaveLength(1);
  });
});
