import { ChangeDetectionStrategy, Component, computed, inject, input, OnDestroy } from '@angular/core';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { TranslationService } from '../../../core/services/translation';
import { LocalTtsPlayer } from '../../../core/services/local-tts-player';
import { TTS_TOTAL_MAX } from '../../../core/utils/tts-text-chunks';

/** Manual voice for assistant replies only. No auto-play and no message submission. */
@Component({
  selector: 'app-chat-speech',
  imports: [TranslatePipe],
  templateUrl: './chat-speech.html',
  styleUrl: './chat-speech.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatSpeech implements OnDestroy {
  readonly messageId = input.required<string>();
  readonly text = input.required<string>();
  readonly maxTextLength = TTS_TOTAL_MAX;
  readonly player = inject(LocalTtsPlayer);
  private readonly translations = inject(TranslationService);
  readonly checking = computed(() => !this.player.checked());
  readonly configured = computed(() => {
    const status = this.player.available();
    return !!status?.enabled && (this.translations.language() === 'pl'
      ? status.configuredPl : status.configuredEn);
  });

  readonly isActive = () => this.player.activeId() === this.messageId();
  readonly state = () => this.isActive() ? this.player.phase() : 'idle';

  constructor() { void this.player.checkAvailability(); }

  read(): Promise<void> {
    return this.player.read(this.messageId(), this.text(), this.translations.language());
  }
  pause(): void { this.player.pause(); }
  resume(): Promise<void> { return this.player.resume(); }
  stop(): void { this.player.stop(); }
  ngOnDestroy(): void { if (this.isActive()) this.player.stop(); }
}
