import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { describe, expect, it, vi } from 'vitest';
import { ChatVoiceMode } from './chat-voice-mode';
import { VoiceConversationService } from '../../../core/services/voice-conversation';
import { ChatStore } from '../../../core/services/chat-store';
import { TranslationService } from '../../../core/services/translation';

describe('21.3 ChatVoiceMode — explicit opt-in control', () => {
  it('emits toggle but never starts microphone or sends Chat on its own', async () => {
    const mode = { enabled: signal(false), statusKey: signal('voice.conversation.off') };
    const store = { loading: signal(false), sending: signal(false), busy: signal(false),
      sendMessage: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [ChatVoiceMode],
      providers: [
        { provide: ChatStore, useValue: store },
        { provide: VoiceConversationService, useValue: mode },
        { provide: TranslationService, useValue: { translate: (key: string) => key, dictionaryVersion: signal(0) } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(ChatVoiceMode);
    fixture.componentRef.setInput('voiceReady', true);
    fixture.detectChanges();
    const emitted = vi.fn();
    fixture.componentInstance.toggleRequested.subscribe(emitted);
    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('[data-testid="voice-conversation-toggle"]')!.click();
    expect(emitted).toHaveBeenCalledOnce();
    expect(store.sendMessage).not.toHaveBeenCalled();
    expect(mode.enabled()).toBe(false); // The parent must explicitly toggle mode.
  });
});
