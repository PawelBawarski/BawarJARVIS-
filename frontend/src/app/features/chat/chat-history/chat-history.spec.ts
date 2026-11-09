import { Pipe, PipeTransform } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatHistory } from './chat-history';
import { ChatStore } from '../../../core/services/chat-store';
import { ChatApiService } from '../../../core/services/chat-api';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';

@Pipe({ name: 'translate' })
class FakeTranslate implements PipeTransform { transform(value: string): string { return value; } }

describe('ChatHistory', () => {
  const api = { list: vi.fn(), create: vi.fn(), messages: vi.fn(), send: vi.fn(), delete: vi.fn() };
  beforeEach(async () => {
    vi.resetAllMocks();
    api.list.mockResolvedValue([]); api.messages.mockResolvedValue([]);
    api.create.mockResolvedValue({ id: 'new-chat', title: 'Nowa rozmowa',
      createdAt: '2026-11-09T12:00:00Z', updatedAt: '2026-11-09T12:00:00Z' });
    await TestBed.configureTestingModule({
      imports: [ChatHistory], providers: [{ provide: ChatApiService, useValue: api }],
    }).overrideComponent(ChatHistory, {
      remove: { imports: [TranslatePipe] }, add: { imports: [FakeTranslate] },
    }).compileComponents();
  });
  it('new-chat button creates a server conversation', async () => {
    const fixture = TestBed.createComponent(ChatHistory);
    const store = TestBed.inject(ChatStore);
    await vi.waitFor(() => expect(store.loading()).toBe(false));
    fixture.detectChanges();
    fixture.nativeElement.querySelector('.chat-history__new').click();
    await vi.waitFor(() => expect(store.activeId()).toBe('new-chat'));
    expect(api.create).toHaveBeenCalledTimes(1);
  });
});
