import { TestBed } from '@angular/core/testing';
import { Pipe, PipeTransform } from '@angular/core';
import { describe, expect, it, vi } from 'vitest';
import { ChatView } from './chat-view';
import { ChatApiService } from '../../../core/services/chat-api';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';

@Pipe({name: 'translate', standalone: true})
class MockTranslate implements PipeTransform { transform(value: string): string { return value; } }
const msg = (id: string, role: string, content: string) => ({id, role, content, conversationId: 'c1', order: 1});

describe('Chat UI: focus, scroll and pending state', () => {
  it('shows pending user message, scrolls and restores focus after backend reply', async () => {
    let resolve!: (value: unknown) => void;
    const api = {
      list: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({id:'c1',title:'Nowa',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()}),
      messages: vi.fn().mockResolvedValue([]),
      send: vi.fn().mockImplementation(() => new Promise(res => resolve = res)),
      delete: vi.fn(),
    };
    await TestBed.configureTestingModule({imports:[ChatView],providers:[{provide:ChatApiService,useValue:api}]})
      .overrideComponent(ChatView,{remove:{imports:[TranslatePipe]},add:{imports:[MockTranslate]}}).compileComponents();
    const fixture = TestBed.createComponent(ChatView);
    await fixture.whenStable();
    const input = fixture.nativeElement.querySelector('[data-testid="chat-input"]') as HTMLInputElement;
    const scroller = fixture.nativeElement.querySelector('[data-testid="chat-messages"]') as HTMLElement;
    Object.defineProperty(scroller, 'scrollHeight', {configurable:true, value:420});
    scroller.scrollTop = 0;
    fixture.componentInstance.draft.set('Cześć');
    fixture.detectChanges();
    const sending = fixture.componentInstance.sendMessage();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="chat-pending-message"]')?.textContent).toContain('Cześć');
    await new Promise<void>(r => setTimeout(r, 0));
    resolve({userMessage:msg('u1','USER','Cześć'),assistantMessage:msg('a1','ASSISTANT','Witaj!')});
    await sending;
    fixture.detectChanges();
    await fixture.whenStable();
    expect(input.value).toBe('');
    expect(document.activeElement).toBe(input);
    expect(scroller.scrollTop).toBe(scroller.scrollHeight);
    expect(fixture.nativeElement.querySelector('[data-testid="chat-pending-message"]')).toBeNull();
  });
  it('keeps the draft and restores focus after a rejected backend request', async () => {
    const api = {list:vi.fn().mockResolvedValue([]),create:vi.fn().mockResolvedValue({id:'c1',title:'Nowa',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()}),messages:vi.fn().mockResolvedValue([]),send:vi.fn().mockRejectedValue(new Error('fail')),delete:vi.fn()};
    await TestBed.configureTestingModule({imports:[ChatView],providers:[{provide:ChatApiService,useValue:api}]})
      .overrideComponent(ChatView,{remove:{imports:[TranslatePipe]},add:{imports:[MockTranslate]}}).compileComponents();
    const fixture = TestBed.createComponent(ChatView);
    await fixture.whenStable();
    fixture.componentInstance.draft.set('Ponów');
    await fixture.componentInstance.sendMessage();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance.draft()).toBe('Ponów');
    expect(document.activeElement).toBe(fixture.nativeElement.querySelector('[data-testid="chat-input"]'));
  });
});
