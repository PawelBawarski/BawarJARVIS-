import { describe, expect, it } from 'vitest';
import { pcmToWhisperWav } from './pcm-wave';

describe('21.0 microphone WAV encoding', () => {
  it('generates exact PCM16 mono 16 kHz header and samples', async () => {
    const wav = pcmToWhisperWav(new Float32Array(8_000).fill(0.5), 16_000);
    const bytes = await wav.arrayBuffer();
    const view = new DataView(bytes);
    expect(wav.type).toBe('audio/wav');
    expect(view.getUint32(24, true)).toBe(16_000);
    expect(view.getUint16(22, true)).toBe(1);
    expect(view.getUint16(34, true)).toBe(16);
    expect(view.getInt16(44, true)).toBe(16384);
    expect(view.getUint32(40, true)).toBe(16_000);
  });
  it('downsamples to 16k and rejects too-short and oversized recordings', async () => {
    const bytes = await pcmToWhisperWav(new Float32Array(48_000), 48_000).arrayBuffer();
    expect(bytes.byteLength).toBe(44 + 32_000);
    expect(() => pcmToWhisperWav(new Float32Array(100), 16_000)).toThrow();
    expect(() => pcmToWhisperWav(new Float32Array(250_000), 16_000)).toThrow();
  });
});
