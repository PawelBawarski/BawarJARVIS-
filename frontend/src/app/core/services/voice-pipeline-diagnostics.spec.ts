import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { VoicePipelineDiagnostics } from './voice-pipeline-diagnostics';
import { ChatApiService } from './chat-api';
import { LocalVoiceApi } from './voice-api';
import { LocalTtsApi } from './local-tts-api';

function setup() {
  const voice = { status: vi.fn().mockResolvedValue({ enabled: true, configured: true }) };
  const chat = { modelStatus: vi.fn().mockResolvedValue({ model: 'qwen', ready: true }) };
  const tts = { status: vi.fn().mockResolvedValue({ enabled: true, configuredPl: true, configuredEn: false }) };
  TestBed.configureTestingModule({ providers: [
    { provide: LocalVoiceApi, useValue: voice },
    { provide: ChatApiService, useValue: chat },
    { provide: LocalTtsApi, useValue: tts },
  ] });
  return { diag: TestBed.inject(VoicePipelineDiagnostics), voice, chat, tts };
}

describe('21.4 local engine diagnostics', () => {
  afterEach(() => { vi.useRealTimers(); TestBed.resetTestingModule(); });

  it('never sends requests or starts a microphone merely by being constructed', () => {
    const { diag, voice, chat, tts } = setup();
    expect(diag.checked()).toBe(false);
    expect(diag.whisper()).toBe('unknown');
    expect(voice.status).not.toHaveBeenCalled();
    expect(chat.modelStatus).not.toHaveBeenCalled();
    expect(tts.status).not.toHaveBeenCalled();
  });

  it('checks three local endpoints and reports both Piper languages independently', async () => {
    const { diag, voice, chat, tts } = setup();
    await diag.refresh();
    expect(diag.checked()).toBe(true);
    expect(diag.checking()).toBe(false);
    expect([diag.whisper(), diag.qwen(), diag.piperPl(), diag.piperEn()])
      .toEqual(['ready', 'ready', 'ready', 'offline']);
    expect(voice.status).toHaveBeenCalledOnce();
    expect(chat.modelStatus).toHaveBeenCalledOnce();
    expect(tts.status).toHaveBeenCalledOnce();
  });

  it('reports failures and recovers on manual retry without restarting Angular', async () => {
    const { diag, voice, chat, tts } = setup();
    voice.status.mockRejectedValueOnce(new Error('Whisper offline'));
    chat.modelStatus.mockRejectedValueOnce(new Error('Qwen offline'));
    tts.status.mockRejectedValueOnce(new Error('Piper offline'));
    await diag.refresh();
    expect([diag.whisper(), diag.qwen(), diag.piperPl(), diag.piperEn()])
      .toEqual(['offline', 'offline', 'offline', 'offline']);
    await diag.refresh();
    expect([diag.whisper(), diag.qwen(), diag.piperPl(), diag.piperEn()])
      .toEqual(['ready', 'ready', 'ready', 'offline']);
    expect(chat.modelStatus).toHaveBeenCalledTimes(2);
  });

  it('times out if an engine status endpoint never answers', async () => {
    const { diag, voice } = setup();
    vi.useFakeTimers();
    voice.status.mockImplementationOnce(() => new Promise(() => {}));
    const pending = diag.refresh();
    await vi.advanceTimersByTimeAsync(5_001);
    await pending;
    expect(diag.whisper()).toBe('offline');
    expect(diag.qwen()).toBe('ready');
    expect(diag.checking()).toBe(false);
  });

  it('coalesces parallel checks into one request per endpoint', async () => {
    const { diag, voice } = setup();
    let resolve!: (value: { enabled: boolean; configured: boolean }) => void;
    voice.status.mockImplementationOnce(() => new Promise(r => { resolve = r; }));
    const a = diag.refresh();
    const b = diag.refresh();
    expect(b).toBe(a);
    await Promise.resolve();
    resolve({ enabled: true, configured: true });
    await Promise.all([a, b]);
    expect(voice.status).toHaveBeenCalledOnce();
  });
});
