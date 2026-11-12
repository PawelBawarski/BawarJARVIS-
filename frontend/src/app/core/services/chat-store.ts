import { computed, inject, Injectable, signal } from '@angular/core';
import { ChatConversation } from '../../features/chat/models/chat-conversation';
import { ChatMessage } from '../../features/chat/models/chat-message';
import { ApiConversation, ApiMessage, ChatApiError, ChatApiService } from './chat-api';

function mapMessage(message: ApiMessage): ChatMessage {
  // Message IDs remain UUIDs; the UI uses them only for Angular tracking.
  return {
    id: message.id,
    role: message.role === 'USER' ? 'user' : 'assistant',
    content: message.content,
  };
}
function mapConversation(chat: ApiConversation): ChatConversation {
  return {
    id: chat.id,
    title: chat.title,
    createdAt: Date.parse(chat.createdAt),
    updatedAt: Date.parse(chat.updatedAt),
    messages: [],
  };
}
function emptyChat(): ChatConversation {
  return { id: '', title: '', createdAt: 0, updatedAt: 0, messages: [] };
}

/** Server owns persistence. Do not reintroduce localStorage as a second source of truth. */
@Injectable({ providedIn: 'root' })
export class ChatStore {
  private readonly api = inject(ChatApiService);
  private readonly chats = signal<ChatConversation[]>([emptyChat()]);
  private readonly selectedId = signal('');
  private messagesAbort?: AbortController;
  readonly loading = signal(true);
  readonly sending = signal(false);
  readonly busy = signal(false);
  readonly connected = signal(false);
  readonly saveError = signal(false);
  readonly errorKey = signal('');

  readonly conversations = computed(() =>
    [...this.chats()].sort((a, b) => b.updatedAt - a.updatedAt),
  );
  readonly activeId = computed(() => this.selectedId());
  readonly activeChat = computed(
    () => this.chats().find((chat) => chat.id === this.selectedId()) ?? emptyChat(),
  );
  readonly messages = computed(() => this.activeChat().messages);

  constructor() {
    void this.loadConversations();
  }

  async loadConversations(): Promise<void> {
    this.loading.set(true);
    try {
      const chats = (await this.api.list()).map(mapConversation);
      const previous = this.selectedId();
      const id = chats.some((chat) => chat.id === previous) ? previous : (chats[0]?.id ?? '');
      this.chats.set(chats.length ? chats : [emptyChat()]);
      this.selectedId.set(id);
      this.connected.set(true);
      this.clearError();
      if (id) await this.loadMessages(id);
    } catch (error) {
      this.connected.set(false);
      this.setError(error);
    } finally {
      this.loading.set(false);
    }
  }

  /** Compatible with existing ChatHistory UI. */
  newChat(): void {
    void this.createChat();
  }
  async createChat(): Promise<boolean> {
    if (this.busy() || this.sending() || this.loading()) return false;
    this.busy.set(true);
    try {
      const chat = mapConversation(await this.api.create());
      this.chats.update((chats) => [chat, ...chats.filter((c) => c.id !== '')]);
      this.selectedId.set(chat.id);
      this.connected.set(true);
      this.clearError();
      return true;
    } catch (error) {
      this.setError(error);
      return false;
    } finally {
      this.busy.set(false);
    }
  }

  /** Compatible with existing ChatHistory UI. */
  selectChat(id: string): void {
    if (!this.chats().some((chat) => chat.id === id)) return;
    this.messagesAbort?.abort();
    this.selectedId.set(id);
    this.clearError();
    if (id) void this.loadMessages(id);
  }
  async loadMessages(id: string): Promise<void> {
    if (!id) return;
    // Cancel obsolete GETs when a different conversation becomes active.
    this.messagesAbort?.abort();
    const controller = new AbortController();
    this.messagesAbort = controller;
    const previousMessages = this.chats().find((c) => c.id === id)?.messages;
    try {
      const messages = (await this.api.messages(id, controller.signal))
        .filter((msg) => msg.role !== 'SYSTEM')
        .map(mapMessage);
      if (controller.signal.aborted || this.selectedId() !== id) return;
      this.chats.update((chats) =>
        chats.map((c) => (c.id === id && c.messages === previousMessages ? { ...c, messages } : c)),
      );
      this.clearError();
    } catch (error) {
      // A user switching chats should never see an error from an abandoned request.
      if (!controller.signal.aborted && this.selectedId() === id) this.setError(error);
    } finally {
      if (this.messagesAbort === controller) this.messagesAbort = undefined;
    }
  }

  /** Legacy call-sites can still validate a draft synchronously. */
  addUserMessage(text: string): boolean {
    const content = text.trim();
    if (!content || content.length > 4000 || this.sending()) return false;
    void this.sendMessage(content);
    return true;
  }

  async sendMessage(input: string): Promise<boolean> {
    const text = input.trim();
    if (!text || text.length > 4000 || this.sending() || this.busy() || this.loading())
      return false;
    this.sending.set(true);
    try {
      let id = this.selectedId();
      if (!id) {
        const created = mapConversation(await this.api.create());
        id = created.id;
        this.chats.update((chats) => [created, ...chats.filter((c) => c.id !== '')]);
        this.selectedId.set(id);
      }
      const turn = await this.api.send(id, text);
      const messages = [mapMessage(turn.userMessage), mapMessage(turn.assistantMessage)];
      this.chats.update((chats) =>
        chats.map((chat) =>
          chat.id === id
            ? {
                ...chat,
                // BE 11.3 does not yet support renaming a conversation.
                updatedAt: Date.now(),
                messages: [...chat.messages, ...messages],
              }
            : chat,
        ),
      );
      this.connected.set(true);
      this.clearError();
      return true;
    } catch (error) {
      this.setError(error);
      if (error instanceof ChatApiError && error.status === 0) {
        this.errorKey.set('chat.deliveryUncertain');
      }
      return false;
    } finally {
      this.sending.set(false);
    }
  }

  deleteActiveChat(): void {
    void this.removeActiveChat();
  }
  async removeActiveChat(): Promise<boolean> {
    const id = this.selectedId();
    if (!id || this.busy() || this.sending()) return false;
    this.busy.set(true);
    try {
      await this.api.delete(id);
      this.chats.update((chats) => {
        const remaining = chats.filter((chat) => chat.id !== id);
        return remaining.length ? remaining : [emptyChat()];
      });
      this.selectedId.set(this.chats()[0].id);
      this.clearError();
      if (this.selectedId()) await this.loadMessages(this.selectedId());
      return true;
    } catch (error) {
      this.setError(error);
      return false;
    } finally {
      this.busy.set(false);
    }
  }

  private clearError(): void {
    this.saveError.set(false);
    this.errorKey.set('');
  }
  private setError(error: unknown): void {
    this.saveError.set(true);
    this.errorKey.set(
      error instanceof ChatApiError && error.status === 503 && error.message === 'LLM_NOT_READY'
        ? 'chat.llmUnavailable'
        : error instanceof ChatApiError && (error.status === 401 || error.status === 403)
          ? 'chat.authRequired'
          : error instanceof ChatApiError && error.status === 0
            ? 'chat.backendUnavailable'
            : 'chat.requestFailed',
    );
  }

  async renameChat(id: string, title: string): Promise<boolean> {
    const nextTitle = title.trim();
    if (
      !id ||
      !nextTitle ||
      nextTitle.length > 200 ||
      this.busy() ||
      this.sending() ||
      this.loading()
    ) {
      return false;
    }

    this.busy.set(true);
    try {
      const updated = mapConversation(await this.api.rename(id, nextTitle));
      const existingMessages = this.chats().find((chat) => chat.id === id)?.messages ?? [];

      this.chats.update((chats) =>
        chats.map((chat) => (chat.id === id ? { ...updated, messages: existingMessages } : chat)),
      );

      this.connected.set(true);
      this.clearError();
      return true;
    } catch (error) {
      this.setError(error);
      return false;
    } finally {
      this.busy.set(false);
    }
  }
}
