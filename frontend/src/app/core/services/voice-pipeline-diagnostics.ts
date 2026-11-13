import { Injectable, inject, signal } from '@angular/core';
import { ChatApiService } from './chat-api';
import { LocalTtsPlayer } from './local-tts-player';
import { LocalVoiceApi } from './voice-api';

export type VoiceEngineHealth = 'unknown' | 'ready' | 'offline';

const HEALTH_TIMEOUT_MS = 5_000;

/** Bounded, read-only GET diagnostics. Never captures audio or sends Chat/voice POSTs. */
async function boundedStatus<T>(request: () => Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve().then(request),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error('VOICE_HEALTH_TIMEOUT')), HEALTH_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/** Explicit, manual health-check of three local engines; no polling, persistence or telemetry. */
@Injectable({ providedIn: 'root' })
export class VoicePipelineDiagnostics {
  private readonly whisperApi = inject(LocalVoiceApi);
  private readonly qwenApi = inject(ChatApiService);
  private readonly player = inject(LocalTtsPlayer);

  readonly checking = signal(false);
  readonly checked = signal(false);
  readonly whisper = signal<VoiceEngineHealth>('unknown');
  readonly qwen = signal<VoiceEngineHealth>('unknown');
  readonly piperPl = signal<VoiceEngineHealth>('unknown');
  readonly piperEn = signal<VoiceEngineHealth>('unknown');

  private inFlight: Promise<void> | null = null;

  refresh(): Promise<void> {
    if (this.inFlight) return this.inFlight;
    this.checking.set(true);
    const pending = Promise.all([
      boundedStatus(() => this.whisperApi.status()).then(
        value => value.enabled === true && value.configured === true ? 'ready' as const : 'offline' as const,
        () => 'offline' as const,
      ),
      boundedStatus(() => this.qwenApi.modelStatus()).then(
        value => value.ready === true ? 'ready' as const : 'offline' as const,
        () => 'offline' as const,
      ),
      boundedStatus(async () => {
        // Also refreshes ChatSpeech buttons: a newly started Piper must be usable without reload.
        await this.player.checkAvailability(true);
        return this.player.available();
      }).then(
        value => ({
          pl: value?.enabled === true && value?.configuredPl === true ? 'ready' as const : 'offline' as const,
          en: value?.enabled === true && value?.configuredEn === true ? 'ready' as const : 'offline' as const,
        }),
        () => ({ pl: 'offline' as const, en: 'offline' as const }),
      ),
    ]).then(([whisper, qwen, piper]) => {
      this.whisper.set(whisper);
      this.qwen.set(qwen);
      this.piperPl.set(piper.pl);
      this.piperEn.set(piper.en);
      this.checked.set(true);
    }).finally(() => {
      this.checking.set(false);
      this.inFlight = null;
    });
    this.inFlight = pending;
    return pending;
  }
}
