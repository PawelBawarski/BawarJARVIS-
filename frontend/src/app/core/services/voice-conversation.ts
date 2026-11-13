import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { ChatStore } from './chat-store';
import { LocalTtsPlayer } from './local-tts-player';
import { ModuleNavigationService } from './module-navigation.service';
import { TranslationService } from './translation';

export type VoiceTurnResult = 'ignored' | 'sent' | 'failed' | 'cancelled';

/**
 * Explicit one-turn voice dialogue. Recording remains push-to-talk in ChatVoice.
 * This service never starts a microphone and never retries a POST to the model.
 * Disabling prevents a late model reply from being spoken, but cannot undo an
 * already accepted HTTP message or interrupt server-side Qwen generation.
 */
@Injectable({ providedIn: 'root' })
export class VoiceConversationService {
  private readonly store = inject(ChatStore);
  private readonly player = inject(LocalTtsPlayer);
  private readonly navigation = inject(ModuleNavigationService);
  private readonly translation = inject(TranslationService);
  readonly enabled = signal(false);
  readonly pending = signal(false);
  readonly errorKey = signal<string | null>(null);
  readonly lastTranscript = signal('');
  private readonly spokenId = signal<string | null>(null);

  private sequence = 0;
  private conversationId = '';
  readonly statusKey = computed(() => {
    if (!this.enabled()) return 'voice.conversation.off';
    if (this.pending()) return 'voice.conversation.thinking';
    if (this.errorKey()) return this.errorKey()!;
    if (this.spokenId() && this.player.activeId() === this.spokenId()) {
      switch (this.player.phase()) {
        case 'loading': return 'voice.conversation.synthesizing';
        case 'ready': return 'voice.conversation.readyToPlay';
        case 'playing': return 'voice.conversation.speaking';
        case 'paused': return 'voice.conversation.paused';
        case 'error': return 'voice.conversation.speechFailed';
        default: break;
      }
    }
    return 'voice.conversation.ready';
  });

  constructor() {
    effect(() => {
      if (this.navigation.activeId() !== 'chat' && this.enabled()) this.disable();
    });
    effect(() => {
      const selected = this.store.activeId();
      if (this.enabled() && this.conversationId && selected !== this.conversationId) {
        this.disable();
      }
    });
  }

  enable(): void {
    if (this.navigation.activeId() !== 'chat' || this.pending()) return;
    this.conversationId = this.store.activeId();
    this.lastTranscript.set('');
    this.errorKey.set(null);
    this.enabled.set(true);
  }

  /** Stop narration / ignore late replies, but leave the explicit mode enabled. */
  stop(): void {
    ++this.sequence;
    this.pending.set(false);
    this.player.stop();
    this.spokenId.set(null);
    this.errorKey.set(null);
  }

  disable(): void {
    this.stop();
    this.enabled.set(false);
    this.conversationId = '';
    this.lastTranscript.set('');
  }

  async acceptTranscript(raw: string): Promise<VoiceTurnResult> {
    if (!this.enabled() || this.navigation.activeId() !== 'chat') return 'ignored';
    const text = raw.trim();
    if (!text || text.length > 4_000 || this.pending() || this.store.sending() ||
        this.store.busy() || this.store.loading()) {
      this.errorKey.set('voice.conversation.busy');
      return 'failed';
    }

    // Only the selected opt-in mode may turn an STT result into a Chat POST.
    this.stop();
    const token = ++this.sequence;
    const selectedBeforeSend = this.store.activeId();
    this.lastTranscript.set(text);
    this.pending.set(true);
    let sent = false;
    try {
      sent = await this.store.sendMessage(text);
    } catch {
      sent = false;
    } finally {
      if (token === this.sequence) this.pending.set(false);
    }
    if (!this.stillCurrent(token, selectedBeforeSend)) return 'cancelled';
    if (!sent) {
      this.errorKey.set('voice.conversation.sendFailed');
      return 'failed';
    }

    const chatId = this.store.activeId();
    if (!chatId) return 'cancelled';
    this.conversationId = chatId;

    // Require the visible last turn to match the transcript. If navigation
    // changed during a new-chat creation, never narrate some other chat's text.
    const messages = this.store.messages();
    const user = messages.at(-2);
    const answer = messages.at(-1);
    if (user?.role !== 'user' || user.content !== text ||
        answer?.role !== 'assistant' || !answer.content.trim()) {
      this.errorKey.set('voice.conversation.answerUnavailable');
      return 'sent';
    }
    try {
      // JARVIS_21_4_VOICE_RECHECK: Piper may have started after an earlier failure.
      await this.player.checkAvailability(true);
      if (!this.stillCurrent(token, chatId)) return 'cancelled';
      const locale = this.translation.language() === 'en' ? 'en' : 'pl';
      const status = this.player.available();
      if (!status?.enabled || (locale === 'pl' ? !status.configuredPl : !status.configuredEn)) {
        this.errorKey.set('voice.conversation.ttsUnavailable');
        return 'sent';
      }
      this.spokenId.set(answer.id);
      await this.player.read(answer.id, answer.content, locale);
      if (this.stillCurrent(token, chatId) && this.player.phase() === 'error') {
        this.errorKey.set('voice.conversation.speechFailed');
      }
    } catch {
      if (this.stillCurrent(token, chatId)) {
        this.errorKey.set('voice.conversation.speechFailed');
      }
    }
    return 'sent';
  }

  private stillCurrent(token: number, previousId: string): boolean {
    return token === this.sequence && this.enabled() &&
      this.navigation.activeId() === 'chat' &&
      (!previousId || this.store.activeId() === previousId);
  }
}
