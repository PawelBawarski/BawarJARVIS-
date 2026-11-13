import { effect, inject, Injectable, signal } from '@angular/core';
import { LocalTtsApi, LocalTtsStatus, TtsLanguage } from './local-tts-api';
import { ModuleNavigationService } from './module-navigation.service';
import { splitSpeechText } from '../utils/tts-text-chunks';

export type TtsPlaybackPhase = 'idle' | 'loading' | 'ready' | 'playing' | 'paused' | 'error';

/** Single, explicit Piper player: one chunk at a time, never automatic narration. */
@Injectable({ providedIn: 'root' })
export class LocalTtsPlayer {
  private readonly api = inject(LocalTtsApi);
  private readonly navigation = inject(ModuleNavigationService);
  readonly activeId = signal<string | null>(null);
  readonly phase = signal<TtsPlaybackPhase>('idle');
  readonly partIndex = signal(0); // Zero-based index of the current chunk.
  readonly partTotal = signal(0);
  readonly available = signal<LocalTtsStatus | null>(null);
  readonly checked = signal(false);

  private statusPromise: Promise<void> | null = null;
  private controller: AbortController | null = null;
  private audio: HTMLAudioElement | null = null;
  private objectUrl: string | null = null;
  private parts: string[] = [];
  private language: TtsLanguage = 'pl';
  private pauseRequested = false;
  private version = 0;

  constructor() {
    effect(() => { if (this.navigation.activeId() !== 'chat') this.stop(); });
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) this.stop();
      });
    }
  }

  // JARVIS_21_4_TTS_REFRESH: allow forced retries while coalescing concurrent checks.
  async checkAvailability(force = false): Promise<void> {
    if (this.statusPromise) return this.statusPromise;
    if (this.checked() && !force) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const pending = Promise.race([
      Promise.resolve().then(() => this.api.status()),
      new Promise<LocalTtsStatus>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error('TTS_STATUS_TIMEOUT')), 4_500);
      }),
    ]).then(status => this.available.set(status))
      .catch(() => this.available.set(null))
      .finally(() => {
        if (timer !== undefined) clearTimeout(timer);
        this.checked.set(true);
        this.statusPromise = null;
      });
    this.statusPromise = pending;
    return pending;
  }

  async read(id: string, text: string, language: TtsLanguage): Promise<void> {
    if (this.activeId() === id && this.phase() === 'ready') {
      await this.playPrepared(this.version);
      return;
    }
    if (this.activeId() === id && this.phase() === 'paused') {
      await this.resume();
      return;
    }
    if (this.activeId() === id && (this.phase() === 'playing' || this.phase() === 'loading')) return;

    this.stop();
    const parts = splitSpeechText(text);
    if (!parts.length) { this.phase.set('error'); return; }
    const version = ++this.version;
    this.parts = parts;
    this.language = language;
    this.activeId.set(id);
    this.partIndex.set(0);
    this.partTotal.set(parts.length);
    await this.preparePart(version);
  }

  /** Pause the current WAV or defer playback if synthesis is still in progress. */
  pause(): void {
    if (!this.activeId()) return;
    if (!['playing', 'loading', 'ready'].includes(this.phase())) return;
    this.pauseRequested = true;
    if (this.phase() === 'playing') this.audio?.pause();
    this.phase.set('paused');
  }

  async resume(): Promise<void> {
    if (this.phase() !== 'paused' || !this.activeId()) return;
    this.pauseRequested = false;
    if (this.audio) {
      await this.playPrepared(this.version);
    } else {
      // The in-flight synthesis will play the WAV when it finishes.
      this.phase.set('loading');
    }
  }

  private async preparePart(version: number): Promise<void> {
    if (version !== this.version) return;
    this.releaseAudio();
    const index = this.partIndex();
    if (index >= this.parts.length) { this.stop(); return; }
    this.phase.set(this.pauseRequested ? 'paused' : 'loading');
    const controller = new AbortController();
    this.controller = controller;
    try {
      const wav = await this.api.synthesize(this.parts[index], this.language, controller.signal);
      if (version !== this.version || this.navigation.activeId() !== 'chat') return;
      this.controller = null;
      this.objectUrl = URL.createObjectURL(wav);
      const audio = new Audio(this.objectUrl);
      this.audio = audio;
      audio.onended = () => {
        if (version !== this.version || this.audio !== audio) return;
        this.releaseAudio();
        this.partIndex.set(index + 1);
        if (this.partIndex() >= this.parts.length) this.stop();
        else void this.preparePart(version);
      };
      audio.onerror = () => {
        if (version === this.version && this.audio === audio) this.phase.set('error');
      };
      if (this.pauseRequested) { this.phase.set('paused'); return; }
      this.phase.set('ready');
      // Async synthesis can lose browser user-activation. Keep WAV on 'ready' if rejected.
      await this.playPrepared(version);
    } catch {
      if (version === this.version) {
        this.controller = null;
        this.phase.set('error');
      }
    }
  }

  private async playPrepared(version: number): Promise<void> {
    const media = this.audio;
    if (!media || this.pauseRequested) return;
    try {
      await media.play();
      if (version === this.version && this.audio === media && !this.pauseRequested && !media.paused) {
        this.phase.set('playing');
      }
    } catch {
      if (version === this.version && this.audio === media) {
        this.phase.set(this.pauseRequested ? 'paused' : 'ready');
      }
    }
  }

  private releaseAudio(): void {
    if (this.audio) {
      const audio = this.audio;
      this.audio = null;
      audio.onended = null;
      audio.onerror = null;
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    }
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
    this.objectUrl = null;
  }

  stop(): void {
    this.version++;
    this.controller?.abort();
    this.controller = null;
    this.releaseAudio();
    this.parts = [];
    this.pauseRequested = false;
    this.activeId.set(null);
    this.partIndex.set(0);
    this.partTotal.set(0);
    this.phase.set('idle');
  }
}
