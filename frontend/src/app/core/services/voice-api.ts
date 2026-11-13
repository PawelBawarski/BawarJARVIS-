import { Injectable } from '@angular/core';
import { browserApi } from './browser-api';

export interface LocalVoiceStatus { readonly enabled: boolean; readonly configured: boolean; }
export interface LocalVoiceTranscript { readonly text: string; readonly language: 'pl' | 'en'; }

/** Never automatically retry a recording POST: a request can already be processing. */
@Injectable({ providedIn: 'root' })
export class LocalVoiceApi {
  status(): Promise<LocalVoiceStatus> {
    return browserApi<LocalVoiceStatus>('GET', '/api/ai-lab/voice/status');
  }

  async transcribe(wav: Blob, language: 'pl' | 'en', signal?: AbortSignal): Promise<LocalVoiceTranscript> {
    const form = new FormData();
    form.append('file', wav, 'microphone.wav');
    form.append('language', language);
    let response: Response;
    try {
      response = await fetch('/api/ai-lab/voice/transcribe', {
        method: 'POST', body: form, credentials: 'same-origin', signal,
      });
    } catch { throw new Error('VOICE_UNAVAILABLE'); }
    if (!response.ok) throw new Error('VOICE_UNAVAILABLE');
    const value: unknown = await response.json();
    if (!value || typeof value !== 'object' || !('text' in value) ||
      typeof value.text !== 'string' || !value.text.trim() || value.text.length > 4_000 ||
      !('language' in value) || value.language !== language) {
      throw new Error('VOICE_INVALID_RESPONSE');
    }
    return { text: value.text.trim(), language };
  }
}
