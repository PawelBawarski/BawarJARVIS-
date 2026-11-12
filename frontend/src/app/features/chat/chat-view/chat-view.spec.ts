import { TestBed } from '@angular/core/testing';
import { Pipe, PipeTransform } from '@angular/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatView } from './chat-view';
import { ChatStore } from '../../../core/services/chat-store';
import { ChatApiService } from '../../../core/services/chat-api';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';

@Pipe({ name: 'translate' })
class FakeTranslate implements PipeTransform { transform(value: string): string { return value === 'chat.modelTitle' ? 'Silnik rozmowy: lokalny Qwen3 8B —' : value; } }

describe('ChatView — actual backend messages, unchanged layout', () => {
  const api = { list: vi.fn(), create: vi.fn(), messages: vi.fn(), send: vi.fn(), delete: vi.fn(), modelStatus: vi.fn() };
  beforeEach(async () => {
    vi.resetAllMocks();
    api.list.mockResolvedValue([]); api.messages.mockResolvedValue([]);
    api.modelStatus.mockResolvedValue({model:'jarvis-qwen3-8b',ready:true});
    api.create.mockResolvedValue({ id: 'chat1', title: 'Nowa rozmowa',
      createdAt: '2026-11-09T12:00:00Z', updatedAt: '2026-11-09T12:00:00Z' });
    api.send.mockResolvedValue({
      userMessage: { id: 'u1', role: 'USER', content: 'Cześć', conversationId: 'chat1', order: 1 },
      assistantMessage: { id: 'a1', role: 'ASSISTANT', content: 'Witaj!', conversationId: 'chat1', order: 2 },
    });
    await TestBed.configureTestingModule({
      imports: [ChatView], providers: [{ provide: ChatApiService, useValue: api }],
    }).overrideComponent(ChatView, {
      remove: { imports: [TranslatePipe] }, add: { imports: [FakeTranslate] },
    }).compileComponents();
  });
  it('keeps the original chat layout and welcome view', async () => {
    const fixture = TestBed.createComponent(ChatView);
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.composer')).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('J.A.R.V.I.S.');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="chat-model-mode"]')?.textContent).toContain('Silnik rozmowy: lokalny Qwen3 8B');
  });
  it('displays actual model availability from backend', async () => {
    api.modelStatus.mockResolvedValue({model:'jarvis-qwen3-8b',ready:false});
    const fixture = TestBed.createComponent(ChatView);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.componentInstance.modelReady()).toBe(false);
  });
  it('shows backend assistant response after send, never fake text', async () => {
    const fixture = TestBed.createComponent(ChatView);
    const component = fixture.componentInstance;
    await fixture.whenStable();
    component.draft.set('Cześć');
    await component.sendMessage();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.message--user').textContent).toContain('Cześć');
    expect(fixture.nativeElement.querySelector('.message--assistant').textContent).toContain('Witaj!');
    expect(component.draft()).toBe('');
  });
  it('retains draft after backend error', async () => {
    api.send.mockRejectedValue(new Error('Backend stopped'));
    const fixture = TestBed.createComponent(ChatView);
    await fixture.whenStable();
    fixture.componentInstance.draft.set('Cześć');
    await fixture.componentInstance.sendMessage();
    expect(fixture.componentInstance.draft()).toBe('Cześć');
    expect(fixture.componentInstance.store.saveError()).toBe(true);
  });
});
