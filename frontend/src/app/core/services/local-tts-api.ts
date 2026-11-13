import { Injectable } from '@angular/core';
import { browserApi } from './browser-api';

export type TtsLanguage = 'pl' | 'en';
export interface LocalTtsStatus {
  readonly enabled: boolean;
  readonly configuredPl: boolean;
  readonly configuredEn: boolean;
}

/** Requests remain same-origin. Audio is not stored in PostgreSQL or localStorage. */
@Injectable({ providedIn: 'root' })
export class LocalTtsApi {
  status(): Promise<LocalTtsStatus> {
    return browserApi<LocalTtsStatus>('GET', '/api/ai-lab/tts/status');
  }

  async synthesize(text: string, language: TtsLanguage, signal?: AbortSignal): Promise<Blob> {
    if (!text.trim() || text.length > 1_200) throw new Error('TTS_TEXT_INVALID');
    let response: Response;
    try {
      response = await fetch('/api/ai-lab/tts/synthesize', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, language }), signal,
      });
    } catch { throw new Error(signal?.aborted ? 'TTS_CANCELLED' : 'TTS_UNAVAILABLE'); }
    if (!response.ok) throw new Error('TTS_UNAVAILABLE');
    if (!/^audio\/(?:wav|x-wav)(?:;|$)/i.test(response.headers.get('content-type') || '')) {
      throw new Error('TTS_INVALID_AUDIO');
    }
    const blob = await response.blob();
    if (blob.size < 44 || blob.size > 8 * 1024 * 1024) throw new Error('TTS_INVALID_AUDIO');
    const head = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
    if (String.fromCharCode(...head.slice(0, 4)) !== 'RIFF' ||
        String.fromCharCode(...head.slice(8, 12)) !== 'WAVE') {
      throw new Error('TTS_INVALID_AUDIO');
    }
    return blob;
  }
}
