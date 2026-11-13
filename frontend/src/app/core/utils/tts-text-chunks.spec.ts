import { describe, expect, it } from 'vitest';
import { splitSpeechText, TTS_CHUNK_MAX, TTS_TOTAL_MAX } from './tts-text-chunks';

describe('21.2 bounded local text-to-speech segmentation', () => {
  it('keeps short sentences together', () => {
    expect(splitSpeechText('Cześć! Jak się masz?')).toEqual(['Cześć! Jak się masz?']);
  });
  it('splits a longer reply into bounded nonempty parts without losing words', () => {
    const sentence = 'Piper czyta odpowiedź, a Jarvis steruje kolejką. ';
    const text = sentence.repeat(130).trim();
    const parts = splitSpeechText(text);
    expect(parts.length).toBeGreaterThan(2);
    expect(parts.every(p => p.length <= TTS_CHUNK_MAX && p.length > 0)).toBe(true);
    expect(parts.join(' ')).toBe(text);
  });
  it('does not split a UTF-16 surrogate pair in an unbroken long token', () => {
    const parts = splitSpeechText('x'.repeat(649) + '😀' + 'y'.repeat(800));
    expect(parts.length).toBeGreaterThan(1);
    expect(parts.join('')).toBe('x'.repeat(649) + '😀' + 'y'.repeat(800));
    expect(parts.every(p => !/[\uD800-\uDBFF]$/.test(p) && !/^[\uDC00-\uDFFF]/.test(p))).toBe(true);
  });
  it('rejects empty, embedded NUL and oversized inputs without any API call', () => {
    expect(splitSpeechText('  ')).toEqual([]);
    expect(splitSpeechText('a\0b')).toEqual([]);
    expect(splitSpeechText('x'.repeat(TTS_TOTAL_MAX + 1))).toEqual([]);
  });
});
