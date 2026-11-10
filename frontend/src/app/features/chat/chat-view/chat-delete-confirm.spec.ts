import { Pipe, PipeTransform } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatView } from './chat-view';
import { ChatStore } from '../../../core/services/chat-store';
import { ChatApiService } from '../../../core/services/chat-api';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';

@Pipe({ name: 'translate' })
class FakeTranslate implements PipeTransform {
  transform(key: string): string { return key; }
}

describe('ChatView 16.A — confirmation before deleting chat', () => {
  const conversation = { id: 'chat-16a', title: 'Test',
    createdAt: '2026-11-10T12:00:00Z', updatedAt: '2026-11-10T12:00:00Z' };
  const api = {
    list: vi.fn(), create: vi.fn(), messages: vi.fn(),
    send: vi.fn(), delete: vi.fn(),
  };
  beforeEach(async () => {
    vi.resetAllMocks();
    api.list.mockResolvedValue([conversation]);
    api.messages.mockResolvedValue([]);
    api.delete.mockResolvedValue(undefined);
    await TestBed.configureTestingModule({
      imports: [ChatView], providers: [{ provide: ChatApiService, useValue: api }],
    }).overrideComponent(ChatView, {
      remove: { imports: [TranslatePipe] }, add: { imports: [FakeTranslate] },
    }).compileComponents();
  });

  it('cancel keeps the conversation and does not call delete', async () => {
    const fixture = TestBed.createComponent(ChatView);
    const store = TestBed.inject(ChatStore);
    await vi.waitFor(() => expect(store.loading()).toBe(false));
    fixture.detectChanges();
    fixture.componentInstance.deleteChat();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alertdialog"]')).toBeTruthy();
    expect(api.delete).not.toHaveBeenCalled();
    fixture.nativeElement.querySelector('[data-testid="chat-delete-cancel"]').click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alertdialog"]')).toBeNull();
    expect(api.delete).not.toHaveBeenCalled();
    expect(store.activeId()).toBe('chat-16a');
  });

  it('calls the backend only after confirmation', async () => {
    const fixture = TestBed.createComponent(ChatView);
    const store = TestBed.inject(ChatStore);
    await vi.waitFor(() => expect(store.loading()).toBe(false));
    fixture.detectChanges();
    fixture.componentInstance.deleteChat();
    fixture.detectChanges();
    expect(api.delete).not.toHaveBeenCalled();
    fixture.nativeElement.querySelector('[data-testid="chat-delete-confirm"]').click();
    await vi.waitFor(() => expect(api.delete).toHaveBeenCalledWith('chat-16a'));
    await vi.waitFor(() => expect(store.activeId()).toBe(''));
  });
});
