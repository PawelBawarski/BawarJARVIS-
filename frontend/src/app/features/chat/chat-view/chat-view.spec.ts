
import { TestBed } from '@angular/core/testing';
import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { ChatView } from './chat-view';
import { ChatStore } from '../../../core/services/chat-store';
import { TranslationService } from '../../../core/services/translation';
import { ConfirmDialogService } from
  '../../../shared/services/confirm-dialog';

describe('ChatView', () => {
  const openDialogMock = vi.fn();

  beforeEach(() => {
    localStorage.removeItem('jarvis.chats.v1');

    openDialogMock.mockReset();
    openDialogMock.mockResolvedValue(false);

    TestBed.configureTestingModule({
      providers: [
        {
          provide: TranslationService,
          useValue: {
            translate: (key: string) => key
          }
        },
        {
          provide: ConfirmDialogService,
          useValue: {
            open: openDialogMock
          }
        }
      ]
    });
  });

  it('should start with an empty conversation', () => {
    const fixture = TestBed.createComponent(ChatView);

    expect(fixture.componentInstance.store.messages())
      .toHaveLength(0);
  });

  it('should save user message without fake AI response', () => {
    const fixture = TestBed.createComponent(ChatView);
    const component = fixture.componentInstance;

    component.draft.set('Cześć Jarvis');
    component.sendMessage();

    expect(component.store.messages()).toHaveLength(1);
    expect(component.store.messages()[0].role)
      .toBe('user');
    expect(component.store.messages()[0].content)
      .toBe('Cześć Jarvis');

    expect(component.draft()).toBe('');
  });

  it('should create a new conversation', () => {
    const fixture = TestBed.createComponent(ChatView);
    const component = fixture.componentInstance;

    component.draft.set('Pierwsza wiadomość');
    component.sendMessage();

    component.newChat();

    expect(component.store.conversations()).toHaveLength(2);
    expect(component.store.messages()).toHaveLength(0);
    expect(component.draft()).toBe('');
  });

  it('should not delete chat without confirmation', async () => {
    const fixture = TestBed.createComponent(ChatView);
    const store = TestBed.inject(ChatStore);

    openDialogMock.mockResolvedValueOnce(false);

    store.addUserMessage('Zachowaj mnie');

    await fixture.componentInstance.deleteChat();

    expect(openDialogMock).toHaveBeenCalledOnce();
    expect(store.messages()).toHaveLength(1);
  });

  it('should delete chat after confirmation', async () => {
    const fixture = TestBed.createComponent(ChatView);
    const store = TestBed.inject(ChatStore);

    openDialogMock.mockResolvedValueOnce(true);

    store.addUserMessage('Usuń mnie');

    await fixture.componentInstance.deleteChat();

    expect(openDialogMock).toHaveBeenCalledOnce();
    expect(store.messages()).toHaveLength(0);
    expect(store.conversations()).toHaveLength(1);
  });
});
