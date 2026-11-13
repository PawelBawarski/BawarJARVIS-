import { TestBed } from '@angular/core/testing';
import { Pipe, PipeTransform, signal } from '@angular/core';
import { describe, expect, it, vi } from 'vitest';
import { ChatSpeech } from './chat-speech';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { LocalTtsPlayer } from '../../../core/services/local-tts-player';
import { TranslationService } from '../../../core/services/translation';

@Pipe({ name: 'translate' })
class FakeTranslate implements PipeTransform { transform(key: string): string { return key; } }

describe('21.1 Chat speech button', () => {
  it('does not call Piper before a click', async () => {
    const player = {
      checked: signal(true), available: signal({ enabled: true, configuredPl: true, configuredEn: true }),
      activeId: signal(null), phase: signal('idle'),
      checkAvailability: vi.fn().mockResolvedValue(undefined),
      read: vi.fn().mockResolvedValue(undefined), stop: vi.fn(),
    };
    await TestBed.configureTestingModule({ imports: [ChatSpeech], providers: [
      { provide: LocalTtsPlayer, useValue: player },
      { provide: TranslationService, useValue: { language: signal('pl') } },
    ] }).overrideComponent(ChatSpeech, {
      remove: { imports: [TranslatePipe] }, add: { imports: [FakeTranslate] },
    }).compileComponents();
    const fixture = TestBed.createComponent(ChatSpeech);
    fixture.componentRef.setInput('messageId', 'msg');
    fixture.componentRef.setInput('text', 'Witaj!');
    await fixture.whenStable();
    fixture.detectChanges();
    expect(player.read).not.toHaveBeenCalled();
    (fixture.nativeElement.querySelector('[data-testid="tts-read"]') as HTMLButtonElement).click();
    expect(player.read).toHaveBeenCalledWith('msg', 'Witaj!', 'pl');
    fixture.destroy();
  });
});
