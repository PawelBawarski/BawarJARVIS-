import { Pipe, PipeTransform } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatView } from './chat-view';
import { ChatApiService } from '../../../core/services/chat-api';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';

@Pipe({ name: 'translate' })
class TestTranslate implements PipeTransform {
  transform(value: string): string { return value; }
}

describe('Chat menu — compact UI and safe actions', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChatView],
      providers: [{ provide: ChatApiService, useValue: {
        list: vi.fn().mockResolvedValue([]),
        modelStatus: vi.fn().mockResolvedValue({ ready: false }),
      } }],
    }).overrideComponent(ChatView, {
      remove: { imports: [TranslatePipe] }, add: { imports: [TestTranslate] },
    }).compileComponents();
  });

  it('starts closed and retains a single header trigger', async () => {
    const fixture = TestBed.createComponent(ChatView);
    await fixture.whenStable();
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelectorAll('[data-testid="chat-tools-toggle"]')).toHaveLength(1);
    expect(element.querySelector('[data-testid="chat-tools-menu"]')?.hasAttribute('hidden')).toBe(true);
    expect(element.querySelector('.message--assistant app-chat-speech')).toBeNull();
  });

  it('opens, closes, and keeps auto-read as an explicit opt-in', async () => {
    const fixture = TestBed.createComponent(ChatView);
    await fixture.whenStable();
    const component = fixture.componentInstance;
    expect(component.toolsOpen()).toBe(false);
    expect(component.autoRead()).toBe(false);
    component.toggleTools();
    fixture.detectChanges();
    expect(component.toolsOpen()).toBe(true);
    component.toggleAutoRead();
    expect(component.autoRead()).toBe(true);
    component.toggleAutoRead();
    expect(component.autoRead()).toBe(false);
    component.closeTools();
    fixture.detectChanges();
    expect(component.toolsOpen()).toBe(false);
  });

  it('keeps new and delete actions outside the burger and removes source controls', async () => {
    const fixture = TestBed.createComponent(ChatView);
    await fixture.whenStable(); fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('[data-testid="chat-header-new"]')).not.toBeNull();
    expect(element.querySelector('[data-testid="chat-header-delete"]')).not.toBeNull();
    expect(element.querySelector('[data-testid="chat-tools-toggle"]')).not.toBeNull();
    expect(element.querySelector('[data-testid="chat-sources-toggle"]')).toBeNull();
    expect(element.querySelector('app-chat-rag-sources')).toBeNull();
  });
});
