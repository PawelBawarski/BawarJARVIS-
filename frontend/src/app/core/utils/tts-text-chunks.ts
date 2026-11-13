/** 21.2: Piper still accepts 1,200 UTF-16 characters/request. Keep a generous margin. */
export const TTS_CHUNK_MAX = 650;
export const TTS_TOTAL_MAX = 12_000;
export const TTS_PART_MAX = 24;

/**
 * Split text locally before sending it to Piper. Prefer sentence endings, then whitespace.
 * Never break a UTF-16 surrogate pair (Java uses the same character unit for its limit).
 * Only the currently spoken part is sent to the backend; nothing is uploaded in bulk.
 */
export function splitSpeechText(input: string): string[] {
  const text = input.replace(/\s+/g, ' ').trim();
  if (!text || input.length > TTS_TOTAL_MAX || text.length > TTS_TOTAL_MAX || text.includes('\0')) {
    return [];
  }
  const parts: string[] = [];
  let remaining = text;
  while (remaining.length) {
    if (parts.length >= TTS_PART_MAX) return [];
    if (remaining.length <= TTS_CHUNK_MAX) {
      parts.push(remaining);
      break;
    }
    let split = TTS_CHUNK_MAX;
    // Prefer a sentence boundary within the latter half of this segment.
    for (let i = TTS_CHUNK_MAX - 1; i >= Math.floor(TTS_CHUNK_MAX * .55); i--) {
      if (/[.!?;:]/.test(remaining[i]) && /\s/.test(remaining[i + 1] || '')) {
        split = i + 1;
        break;
      }
    }
    if (split === TTS_CHUNK_MAX) {
      const space = remaining.lastIndexOf(' ', TTS_CHUNK_MAX);
      if (space >= Math.floor(TTS_CHUNK_MAX * .55)) split = space;
    }
    // Do not split emoji and other supplementary-plane characters across requests.
    if (split > 0 && split < remaining.length &&
        /[\uD800-\uDBFF]/.test(remaining[split - 1]) && /[\uDC00-\uDFFF]/.test(remaining[split])) {
      split--;
    }
    const piece = remaining.slice(0, split).trim();
    if (!piece) return [];
    parts.push(piece);
    remaining = remaining.slice(split).trim();
  }
  return parts;
}
