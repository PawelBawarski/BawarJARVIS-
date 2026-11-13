/** Downsample microphone PCM and produce exactly the WAV subset validated by Spring Boot. */
export function pcmToWhisperWav(input: Float32Array, inputRate: number): Blob {
  if (!Number.isFinite(inputRate) || inputRate < 8_000 || inputRate > 192_000) {
    throw new Error('VOICE_AUDIO_INVALID');
  }
  const targetRate = 16_000;
  const length = Math.floor(input.length * targetRate / inputRate);
  if (length < 3_200 || length > 240_000) throw new Error('VOICE_AUDIO_INVALID');
  const out = new ArrayBuffer(44 + length * 2);
  const view = new DataView(out);
  const ascii = (offset: number, value: string): void => {
    for (let index = 0; index < value.length; index++) view.setUint8(offset + index, value.charCodeAt(index));
  };
  ascii(0, 'RIFF'); view.setUint32(4, 36 + length * 2, true);
  ascii(8, 'WAVE'); ascii(12, 'fmt '); view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, targetRate, true); view.setUint32(28, targetRate * 2, true);
  view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  ascii(36, 'data'); view.setUint32(40, length * 2, true);
  for (let index = 0; index < length; index++) {
    const sourceIndex = Math.min(input.length - 1, Math.floor(index * inputRate / targetRate));
    const n = Math.max(-1, Math.min(1, input[sourceIndex] || 0));
    view.setInt16(44 + index * 2, n < 0 ? Math.round(n * 32768) : Math.round(n * 32767), true);
  }
  return new Blob([out], { type: 'audio/wav' });
}
