
import { Pipe, PipeTransform } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { beforeEach, describe, expect, it } from 'vitest';

import { ChatHistory } from './chat-history';
import { ChatStore } from '../../../core/services/chat-store';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';

@Pipe({
  name: 'translate'
})
class MockTranslatePipe implements PipeTransform {
  transform(key: string): string {
    return key;
  }
}

describe('ChatHistory', () => {

  beforeEach(async () => {
    localStorage.removeItem('jarvis.chats.v1');

    await TestBed.configureTestingModule({
      imports: [ChatHistory]
    })
      .overrideComponent(ChatHistory, {
        remove: { imports: [TranslatePipe] },
        add: { imports: [MockTranslatePipe] }
      })
      .compileComponents();
  });

  it('should display existing chat', async () => {
    const fixture = TestBed.createComponent(ChatHistory);

    await fixture.whenStable();

    const buttons: NodeListOf<HTMLButtonElement> =
      fixture.nativeElement.querySelectorAll(
        '.chat-history__item'
      );

    expect(buttons.length).toBe(1);
  });

  it('should create a new chat', async () => {
    const fixture = TestBed.createComponent(ChatHistory);
    const store = TestBed.inject(ChatStore);

    await fixture.whenStable();

    const button: HTMLButtonElement =
      fixture.nativeElement.querySelector(
        '.chat-history__new'
      );

    button.click();

    await fixture.whenStable();

    expect(store.conversations()).toHaveLength(2);
  });

  it('should switch active chat', async () => {
    const fixture = TestBed.createComponent(ChatHistory);
    const store = TestBed.inject(ChatStore);

    const firstId = store.activeId();
    store.newChat();

    await fixture.whenStable();

    const buttons: NodeListOf<HTMLButtonElement> =
      fixture.nativeElement.querySelectorAll(
        '.chat-history__item'
      );

    buttons[1].click();

    expect(store.activeId()).toBe(firstId);
  });
});
