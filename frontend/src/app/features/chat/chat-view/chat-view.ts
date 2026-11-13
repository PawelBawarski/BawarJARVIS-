// JARVIS_21_3_VIEW
import { ChatVoiceMode } from '../chat-voice-mode/chat-voice-mode';
import { VoiceConversationService } from '../../../core/services/voice-conversation';
import { ChatSpeech } from '../chat-speech/chat-speech';
import { ChatVoice } from '../chat-voice/chat-voice';
import { ChatRagSources } from '../chat-rag-sources/chat-rag-sources';
import { afterEveryRender, ChangeDetectionStrategy, Component, ElementRef, inject, signal, viewChild, DestroyRef } from '@angular/core';
import { ChatStore } from '../../../core/services/chat-store';
import { ChatApiService } from '../../../core/services/chat-api';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { AnimationFrameCoalescer } from '../../../core/utils/animation-frame-coalescer';

@Component({
  selector: 'app-chat-view',
  templateUrl: './chat-view.html',
  styleUrl: './chat-view.scss',
  imports: [TranslatePipe, ChatRagSources, ChatVoice, ChatSpeech, ChatVoiceMode],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatView {
  readonly store = inject(ChatStore);
  readonly voiceConversation = inject(VoiceConversationService);
  readonly voiceRecorder = viewChild(ChatVoice);
  private readonly chatApi = inject(ChatApiService);
  readonly modelReady = signal<boolean | null>(null);
  readonly draft = signal('');
  // JARVIS_16A_SAFE_DELETE_MODAL_V1
  readonly deleteDialogOpen = signal(false);
  private deleteTargetId = "";
  readonly pendingText = signal('');
  readonly messages = this.store.messages;
  readonly messageList = viewChild<ElementRef<HTMLElement>>('messageList');
  readonly messageInput = viewChild<ElementRef<HTMLInputElement>>('messageInput');
  private lastScrollMarker = '';
  private focusAfterReply = false;

  // JARVIS_CHAT_SCROLL_15_6: scroll after message DOM changes and model replies.
  private readonly destroyRef = inject(DestroyRef);
  private observedPane?: HTMLElement;
  private contentObserver?: MutationObserver;
  private readonly scrollScheduler = new AnimationFrameCoalescer();

  constructor() {
    void this.refreshModelStatus();
    this.destroyRef.onDestroy(() => {
      this.contentObserver?.disconnect();
      this.scrollScheduler.cancel();
      if (this.voiceConversation.enabled()) this.voiceConversation.disable();
    });

    afterEveryRender({
      write: () => {
        const pane = this.messageList()?.nativeElement;
        if (pane && pane !== this.observedPane) {
          this.contentObserver?.disconnect();
          this.observedPane = pane;
          // Detect actual DOM insertions, including asynchronous model answers.
          this.contentObserver = new MutationObserver(() => this.scrollToBottom());
          this.contentObserver.observe(pane, {
            childList: true, subtree: true, characterData: true,
          });
          this.scrollToBottom();
        }

        // O(1) marker even for a very long conversation; DOM changes are
        // independently observed for streamed/edited message content.
        const items = this.messages();
        const last = items.at(-1);
        const marker = [
          this.store.activeId(), items.length, last?.id,
          this.pendingText(), this.store.sending(),
        ].join('|');
        if (pane && marker !== this.lastScrollMarker) {
          this.lastScrollMarker = marker;
          this.scrollToBottom();
        }

        if (this.focusAfterReply && !this.store.sending() && !this.store.loading()) {
          const input = this.messageInput()?.nativeElement;
          if (input && !input.disabled) {
            input.focus({ preventScroll: true });
            this.focusAfterReply = false;
          }
        }
      },
    });
  }

  async refreshModelStatus(): Promise<void> {
    this.modelReady.set(null);
    try {
      const status = await this.chatApi.modelStatus();
      this.modelReady.set(status.ready === true);
    } catch {
      this.modelReady.set(false);
    }
  }

  /** The message pane scrolls, not the whole desktop window. */
  private scrollToBottom(): void {
    const pane = this.messageList()?.nativeElement;
    if (!pane) return;
    // Angular and MutationObserver can report the same change in one frame.
    // Batch scrollHeight reads and scrollTop writes to one animation frame.
    this.scrollScheduler.schedule(() => {
      if (pane.isConnected && pane === this.messageList()?.nativeElement) {
        pane.scrollTop = pane.scrollHeight;
      }
    });
  }

  /** Never send a transcription to Qwen without a separate user click. */
  addVoiceDraft(text: string): void {
    if (!text.trim()) return;
    this.draft.update(current => [current.trim(), text.trim()].filter(Boolean).join(" ").slice(0, 4000));
  }

  /** Switching modes never automatically starts a microphone. */
  toggleVoiceConversation(): void {
    if (this.voiceConversation.enabled()) {
      this.voiceRecorder()?.cancel();
      this.voiceConversation.disable();
      return;
    }
    if (this.store.loading() || this.store.sending() || this.store.busy() ||
        !this.voiceRecorder()?.configured() || this.voiceRecorder()?.state() !== 'idle') return;
    this.voiceConversation.enable();
  }

  /** Stop microphone and local audio; server-side Qwen may still finish. */
  stopVoiceConversation(): void {
    this.voiceRecorder()?.cancel();
    this.voiceConversation.stop();
  }

  async onVoiceText(text: string): Promise<void> {
    if (!this.voiceConversation.enabled()) {
      this.addVoiceDraft(text);
      return;
    }
    const clean = text.trim();
    if (!clean) return;
    this.pendingText.set(clean);
    try {
      const result = await this.voiceConversation.acceptTranscript(clean);
      if (result === 'failed' && !this.draft()) this.draft.set(clean);
    } finally {
      this.pendingText.set('');
    }
  }

  async sendMessage(): Promise<void> {
    const text = this.draft().trim();
    if (!text || this.store.sending() || this.store.busy() || this.store.loading()) return;
    this.draft.set('');
    this.pendingText.set(text);
    try {
      const success = await this.store.sendMessage(text);
      if (!success && !this.draft()) this.draft.set(text);
    } catch {
      if (!this.draft()) this.draft.set(text);
    } finally {
      this.pendingText.set('');
      this.focusAfterReply = true;
    }
  }
  newChat(): void {
    if (this.voiceConversation.enabled()) this.voiceConversation.disable();
    this.store.newChat();
  }
  deleteChat(): void {
    // Never delete directly from an unconfirmed click.
    if (!this.store.activeId() || this.store.busy() || this.store.sending() || this.store.loading()) return;
    this.deleteTargetId = this.store.activeId();
    this.deleteDialogOpen.set(true);
  }

  cancelDelete(): void {
    this.deleteDialogOpen.set(false);
    this.deleteTargetId = '';
  }

  async confirmDelete(): Promise<void> {
    if (!this.deleteDialogOpen() || !this.deleteTargetId) return;
    // Do not delete another conversation if selection changed while modal was open.
    if (this.store.activeId() !== this.deleteTargetId) {
      this.cancelDelete();
      return;
    }
    this.cancelDelete();
    if (this.voiceConversation.enabled()) this.voiceConversation.disable();
    await this.store.removeActiveChat();
  }
}
