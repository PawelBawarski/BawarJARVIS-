import { TestBed } from '@angular/core/testing';
import { Pipe, PipeTransform } from '@angular/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatVoice } from './chat-voice';
import { LocalVoiceApi } from '../../../core/services/voice-api';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { TranslationService } from '../../../core/services/translation';

@Pipe({ name: 'translate' })
class FakeTranslate implements PipeTransform { transform(key: string): string { return key; } }

class FakeContext {
  static current: FakeContext;
  sampleRate = 16_000;
  destination = {};
  processor: any;
  constructor(_options: unknown) { FakeContext.current = this; }
  createMediaStreamSource() { return { connect: vi.fn(), disconnect: vi.fn() }; }
  createScriptProcessor() {
    this.processor = { onaudioprocess: null, connect: vi.fn(), disconnect: vi.fn() };
    return this.processor;
  }
  createGain() { return { gain: { value: 0 }, connect: vi.fn(), disconnect: vi.fn() }; }
  close() { return Promise.resolve(); }
}

describe('21.0 local voice dictation', () => {
  const api = { status: vi.fn(), transcribe: vi.fn() };
  const track = { stop: vi.fn() };
  beforeEach(async () => {
    vi.resetAllMocks();
    api.status.mockResolvedValue({ enabled: true, configured: true });
    api.transcribe.mockResolvedValue({ text: 'Cześć Jarvis', language: 'pl' });
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true, value: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [track] }) },
    });
    vi.stubGlobal('AudioContext', FakeContext);
    await TestBed.configureTestingModule({
      imports: [ChatVoice],
      providers: [
        { provide: LocalVoiceApi, useValue: api },
        { provide: TranslationService, useValue: { language: () => 'pl' } },
      ],
    }).overrideComponent(ChatVoice, {
      remove: { imports: [TranslatePipe] }, add: { imports: [FakeTranslate] },
    }).compileComponents();
  });

  it('leaves the microphone closed until explicit click, and never auto-sends a message', async () => {
    const fixture = TestBed.createComponent(ChatVoice);
    const texts: string[] = [];
    fixture.componentInstance.textReady.subscribe(text => texts.push(text));
    await fixture.whenStable();
    fixture.detectChanges();
    expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('[data-testid="voice-start"]')).toBeTruthy();
    await fixture.componentInstance.start();
    FakeContext.current.processor.onaudioprocess({ inputBuffer: {
      getChannelData: () => new Float32Array(8_192).fill(0.2),
    } });
    await fixture.componentInstance.stop();
    expect(api.transcribe).toHaveBeenCalledTimes(1);
    expect(texts).toEqual(['Cześć Jarvis']);
    expect(track.stop).toHaveBeenCalled();
    expect(fixture.componentInstance.state()).toBe('idle');
    fixture.destroy();
  });

  it('disables recording when local Whisper is not configured', async () => {
    api.status.mockResolvedValue({ enabled: false, configured: false });
    const fixture = TestBed.createComponent(ChatVoice);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.componentInstance.configured()).toBe(false);
    await fixture.componentInstance.start();
    expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();
    fixture.destroy();
  });
});
