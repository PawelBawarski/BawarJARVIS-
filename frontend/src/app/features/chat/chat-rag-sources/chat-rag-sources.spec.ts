import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { describe, expect, it, vi } from 'vitest';
import { ChatRagSources } from './chat-rag-sources';
import { ChatStore } from '../../../core/services/chat-store';
import { RagSourcePreviewApi } from '../../../core/services/rag-source-preview-api';
import { TranslationService } from '../../../core/services/translation';

describe('20.4 read-only Chat source previews', () => {
  async function setup() {
    const messages = signal([
      { id: 'user', role: 'user' as const, content: 'Angular Signals?' },
      { id: 'assistant', role: 'assistant' as const, content: 'Angular is reactive.' }
    ]);
    const activeId = signal('conversation-1');
    const api = { preview: vi.fn().mockResolvedValue({ query: 'Angular Signals?', snapshotOfAnswer: false, sources: [
      { id: '1', title: 'Local note', excerpt: 'Signals', method: 'text', externalUrl: null, local: true }
    ] }) };
    await TestBed.configureTestingModule({ imports: [ChatRagSources], providers: [
      { provide: ChatStore, useValue: { messages, activeId } },
      { provide: RagSourcePreviewApi, useValue: api },
      { provide: TranslationService, useValue: { translate: (key: string) => key, dictionaryVersion: () => 0 } },
    ] }).compileComponents();
    const fixture = TestBed.createComponent(ChatRagSources);
    fixture.detectChanges();
    return { component: fixture.componentInstance, fixture, api, messages, activeId };
  }

  it('does not call backend until explicit user action', async () => {
    const { component, api } = await setup();
    expect(api.preview).not.toHaveBeenCalled();
    await component.inspect();
    expect(api.preview).toHaveBeenCalledExactlyOnceWith('Angular Signals?');
    expect(component.visibleResult()?.sources.length).toBe(1);
  });

  it('hides outdated results after conversation change', async () => {
    const { component, activeId } = await setup();
    await component.inspect();
    activeId.set('conversation-2');
    expect(component.visibleResult()).toBeNull();
  });

  it('does not create clickable links from local or unsafe schemes', async () => {
    const { component } = await setup();
    expect(component.safeExternalUrl('javascript:alert(1)')).toBeNull();
    expect(component.safeExternalUrl('file:///etc/passwd')).toBeNull();
    expect(component.safeExternalUrl('https://example.org/note')).toBe('https://example.org/note');
  });
});
