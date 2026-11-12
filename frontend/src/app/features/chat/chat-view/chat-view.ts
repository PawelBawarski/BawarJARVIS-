import { afterEveryRender, Component, ElementRef, inject, signal, viewChild, DestroyRef } from '@angular/core';
import { ChatStore } from '../../../core/services/chat-store';
import { ChatApiService } from '../../../core/services/chat-api';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-chat-view',
  templateUrl: './chat-view.html',
  styleUrl: './chat-view.scss',
  imports: [TranslatePipe],
})
export class ChatView {
  readonly store = inject(ChatStore);
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
  private scrollFrameId?: number;

  constructor() {
    void this.refreshModelStatus();
    this.destroyRef.onDestroy(() => {
      this.contentObserver?.disconnect();
      if (this.scrollFrameId !== undefined && typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(this.scrollFrameId);
      }
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

        const marker = [
          this.store.activeId(),
          ...this.messages().map(message => message.id),
          this.pendingText(),
          String(this.store.sending()),
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
    pane.scrollTop = pane.scrollHeight;
    // One extra pass after layout: useful for fonts and delayed content sizing.
    if (typeof requestAnimationFrame === 'function') {
      if (this.scrollFrameId !== undefined && typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(this.scrollFrameId);
      }
      this.scrollFrameId = requestAnimationFrame(() => {
        this.scrollFrameId = undefined;
        if (pane.isConnected && pane === this.messageList()?.nativeElement) {
          pane.scrollTop = pane.scrollHeight;
        }
      });
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
  newChat(): void { this.store.newChat(); }
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
    await this.store.removeActiveChat();
  }
}
