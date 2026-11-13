import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, input, output, signal } from '@angular/core';
import { LocalVoiceApi } from '../../../core/services/voice-api';
import { ModuleNavigationService } from '../../../core/services/module-navigation.service';
import { TranslationService } from '../../../core/services/translation';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { pcmToWhisperWav } from './pcm-wave';

type RecordingState = 'idle' | 'permission' | 'recording' | 'transcribing';

/** Explicit push-to-talk. Mic audio is never saved in localStorage or automatically sent to Chat. */
@Component({
  selector: 'app-chat-voice',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './chat-voice.html',
  styleUrl: './chat-voice.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatVoice {
  private readonly api = inject(LocalVoiceApi);
  private readonly translation = inject(TranslationService);
  private readonly navigation = inject(ModuleNavigationService);
  private readonly destroyRef = inject(DestroyRef);
  // JARVIS_21_3_VOICE
  readonly textReady = output<string>();
  readonly autoSend = input(false);
  readonly state = signal<RecordingState>('idle');
  readonly configured = signal(false);
  readonly errorKey = signal<string | null>(null);
  readonly language = () => this.translation.language() === 'en' ? 'en' as const : 'pl' as const;

  private stream: MediaStream | null = null;
  private context: AudioContext | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private silence: GainNode | null = null;
  private readonly chunks: Float32Array[] = [];
  private samples = 0;
  private sourceRate = 16_000;
  private timeout: ReturnType<typeof setTimeout> | null = null;
  private pending: AbortController | null = null;
  private generation = 0;

  constructor() {
    void this.refreshStatus();
    effect(() => {
      if (this.navigation.activeId() !== 'chat') this.cancel();
    });
    const onVisibility = () => { if (document.hidden) this.cancel(); };
    document.addEventListener('visibilitychange', onVisibility);
    this.destroyRef.onDestroy(() => {
      document.removeEventListener('visibilitychange', onVisibility);
      this.cancel();
    });
  }

  async refreshStatus(): Promise<void> {
    try {
      const status = await this.api.status();
      this.configured.set(status.enabled && status.configured);
    } catch { this.configured.set(false); }
  }

  async start(): Promise<void> {
    if (!this.configured() || this.state() !== 'idle') return;
    if (!navigator.mediaDevices?.getUserMedia || !window.AudioContext) {
      this.errorKey.set('voice.error.unsupported');
      return;
    }
    const current = ++this.generation;
    this.state.set('permission');
    this.errorKey.set(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true }, video: false,
      });
      if (current !== this.generation || this.navigation.activeId() !== 'chat') {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      this.stream = stream;
      this.context = new AudioContext({ sampleRate: 16_000 });
      this.sourceRate = this.context.sampleRate;
      this.source = this.context.createMediaStreamSource(stream);
      this.processor = this.context.createScriptProcessor(4096, 1, 1);
      this.silence = this.context.createGain();
      this.silence.gain.value = 0;
      this.processor.onaudioprocess = event => {
        if (this.state() !== 'recording') return;
        const samples = event.inputBuffer.getChannelData(0);
        if (this.samples + samples.length > this.sourceRate * 15) {
          void this.stop();
          return;
        }
        const copy = new Float32Array(samples);
        this.chunks.push(copy);
        this.samples += copy.length;
      };
      this.source.connect(this.processor);
      this.processor.connect(this.silence);
      this.silence.connect(this.context.destination);
      this.samples = 0;
      this.chunks.length = 0;
      this.state.set('recording');
      this.timeout = setTimeout(() => void this.stop(), 15_000);
    } catch {
      if (current === this.generation) {
        this.releaseMicrophone();
        this.state.set('idle');
        this.errorKey.set('voice.error.permission');
      }
    }
  }

  async stop(): Promise<void> {
    if (this.state() !== 'recording') return;
    const current = this.generation;
    const all = new Float32Array(this.samples);
    let offset = 0;
    for (const chunk of this.chunks) { all.set(chunk, offset); offset += chunk.length; }
    this.releaseMicrophone();
    this.state.set('transcribing');
    try {
      const wav = pcmToWhisperWav(all, this.sourceRate);
      this.pending = new AbortController();
      const result = await this.api.transcribe(wav, this.language(), this.pending.signal);
      if (current === this.generation && this.navigation.activeId() === 'chat') {
        this.textReady.emit(result.text);
      }
    } catch (error) {
      if (current === this.generation) this.errorKey.set(
        error instanceof Error && error.message === 'VOICE_AUDIO_INVALID' ?
          'voice.error.short' : 'voice.error.unavailable',
      );
    } finally {
      if (current === this.generation) this.state.set('idle');
      if (current === this.generation) this.pending = null;
    }
  }

  cancel(): void {
    this.generation++;
    this.pending?.abort();
    this.pending = null;
    this.releaseMicrophone();
    this.state.set('idle');
  }

  private releaseMicrophone(): void {
    if (this.timeout) clearTimeout(this.timeout);
    this.timeout = null;
    if (this.processor) { this.processor.onaudioprocess = null; this.processor.disconnect(); }
    this.source?.disconnect();
    this.silence?.disconnect();
    this.stream?.getTracks().forEach(track => track.stop());
    if (this.context) void this.context.close().catch(() => undefined);
    this.processor = null;
    this.source = null;
    this.silence = null;
    this.stream = null;
    this.context = null;
    this.chunks.length = 0;
    this.samples = 0;
  }
}
