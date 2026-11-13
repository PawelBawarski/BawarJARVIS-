import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LocalTtsApi } from './local-tts-api';

function fakeWav(): Blob {
  const bytes = new Uint8Array(48);
  bytes.set([82, 73, 70, 70], 0);
  bytes.set([87, 65, 86, 69], 8);
  return { size: 48, slice: () => ({ arrayBuffer: async () => bytes.buffer }) } as unknown as Blob;
}

describe('21.1 local Piper API', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('does not retry a POST, even when Piper is unavailable', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: false, status: 503 });
    vi.stubGlobal('fetch', fetch);
    TestBed.configureTestingModule({});
    await expect(TestBed.inject(LocalTtsApi).synthesize('Hello', 'en')).rejects.toThrow('TTS_UNAVAILABLE');
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][1].credentials).toBe('same-origin');
    expect(fetch.mock.calls[0][1].method).toBe('POST');
  });
  it('accepts only a bounded WAV and rejects arbitrary content', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, headers: new Headers({ 'content-type': 'audio/wav' }),
      blob: async () => fakeWav() });
    vi.stubGlobal('fetch', fetch);
    TestBed.configureTestingModule({});
    await expect(TestBed.inject(LocalTtsApi).synthesize('Cześć', 'pl')).resolves.toHaveProperty('size', 48);
    expect(fetch).toHaveBeenCalledOnce();
    await expect(TestBed.inject(LocalTtsApi).synthesize('x'.repeat(1201), 'pl'))
      .rejects.toThrow('TTS_TEXT_INVALID');
    expect(fetch).toHaveBeenCalledOnce();
  });
});
