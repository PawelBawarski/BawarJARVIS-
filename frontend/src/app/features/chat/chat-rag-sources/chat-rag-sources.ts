import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ChatStore } from '../../../core/services/chat-store';
import { RagPreview, RagSourcePreviewApi } from '../../../core/services/rag-source-preview-api';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';

/** Manual retrieval preview. It must never be presented as a proof of LLM citation. */
@Component({
  selector: 'app-chat-rag-sources',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './chat-rag-sources.html',
  styleUrl: './chat-rag-sources.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatRagSources {
  private readonly store = inject(ChatStore);
  private readonly api = inject(RagSourcePreviewApi);
  private requestSequence = 0;

  readonly question = computed(() => {
    const messages = this.store.messages();
    if (!messages.some(message => message.role === 'assistant')) return '';
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user') return messages[i].content;
    }
    return '';
  });
  readonly loading = signal(false);
  readonly error = signal(false);
  private readonly lastResult = signal<RagPreview | null>(null);
  private readonly lastConversation = signal('');

  readonly visibleResult = computed(() => {
    const result = this.lastResult();
    return result && result.query === this.question().trim() &&
      this.lastConversation() === this.store.activeId() ? result : null;
  });

  async inspect(): Promise<void> {
    const question = this.question().trim();
    const conversation = this.store.activeId();
    if (!question || question.length > 500 || this.loading()) return;
    const sequence = ++this.requestSequence;
    this.lastResult.set(null);
    this.error.set(false);
    this.loading.set(true);
    try {
      const response = await this.api.preview(question);
      if (sequence !== this.requestSequence || question !== this.question().trim() ||
        conversation !== this.store.activeId()) return;
      this.lastConversation.set(conversation);
      this.lastResult.set(response);
    } catch {
      if (sequence === this.requestSequence && question === this.question().trim() &&
        conversation === this.store.activeId()) this.error.set(true);
    } finally {
      if (sequence === this.requestSequence) this.loading.set(false);
    }
  }

  /** Defense-in-depth: never render arbitrary knowledge source schemes as links. */
  safeExternalUrl(url: string | null): string | null {
    if (!url) return null;
    try {
      const parsed = new URL(url);
      if ((parsed.protocol === 'https:' || parsed.protocol === 'http:') &&
          parsed.hostname && !parsed.username && !parsed.password) return parsed.href;
    } catch { /* local knowledge IDs are not browser URLs */ }
    return null;
  }
}
