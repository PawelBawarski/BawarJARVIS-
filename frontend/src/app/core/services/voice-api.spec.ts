import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LocalVoiceApi } from './voice-api';

describe('21.0 voice API', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('never retries POST even when Whisper is unavailable', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: false, status: 503 });
    vi.stubGlobal('fetch', fetch);
    TestBed.configureTestingModule({});
    const api = TestBed.inject(LocalVoiceApi);
    await expect(api.transcribe(new Blob(['fake'], { type: 'audio/wav' }), 'pl'))
      .rejects.toThrow('VOICE_UNAVAILABLE');
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][1].method).toBe('POST');
    expect(fetch.mock.calls[0][1].credentials).toBe('same-origin');
  });

  it('accepts only a nonempty transcript of the requested language', async () => {
    const fetch = vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ text: '  Cześć  ', language: 'pl' }),
    });
    vi.stubGlobal('fetch', fetch);
    TestBed.configureTestingModule({});
    const api = TestBed.inject(LocalVoiceApi);
    await expect(api.transcribe(new Blob(['fake']), 'pl'))
      .resolves.toEqual({ text: 'Cześć', language: 'pl' });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
