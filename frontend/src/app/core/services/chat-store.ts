import { DOCUMENT } from '@angular/common';
import { computed, inject, Injectable, signal } from '@angular/core';

import { ChatConversation } from '../../features/chat/models/chat-conversation';

import { ChatMessage } from '../../features/chat/models/chat-message';

interface ChatState {
  version: 1;
  activeId: string;
  chats: ChatConversation[];
}

const STORAGE_KEY = 'jarvis.chats.v1';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isChat(value: unknown): value is ChatConversation {
  if (!isObject(value) || !Array.isArray(value['messages'])) {
    return false;
  }

  return (
    typeof value['id'] === 'string' &&
    typeof value['title'] === 'string' &&
    typeof value['createdAt'] === 'number' &&
    Number.isFinite(value['createdAt']) &&
    typeof value['updatedAt'] === 'number' &&
    Number.isFinite(value['updatedAt']) &&
    value['messages'].every(
      (message: unknown) =>
        isObject(message) &&
        Number.isSafeInteger(message['id']) &&
        (message['role'] === 'user' || message['role'] === 'assistant') &&
        typeof message['content'] === 'string',
    )
  );
}

@Injectable({
  providedIn: 'root',
})
export class ChatStore {
  private readonly document = inject(DOCUMENT);

  private readonly state = signal<ChatState>(this.restore() ?? this.createInitialState());

  readonly saveError = signal(false);

  readonly conversations = computed(() =>
    [...this.state().chats].sort((a, b) => b.updatedAt - a.updatedAt),
  );

  readonly activeId = computed(() => this.state().activeId);

  readonly activeChat = computed(() =>
    this.state().chats.find((chat) => chat.id === this.state().activeId)!,
  );

  readonly messages = computed(() => this.activeChat().messages);

  constructor() {
    this.persist();
  }

  newChat(): void {
    const chat = this.createEmptyChat();
    const current = this.state();

    this.commit({
      version: 1,
      activeId: chat.id,
      chats: [chat, ...current.chats],
    });
  }

  selectChat(id: string): void {
    const current = this.state();

    if (!current.chats.some((chat) => chat.id === id)) {
      return;
    }

    this.commit({
      ...current,
      activeId: id,
    });
  }

  addUserMessage(text: string): boolean {
    const content = text.trim();

    if (!content || content.length > 4000) {
      return false;
    }

    const current = this.state();

    const chats = current.chats.map((chat) => {
      if (chat.id !== current.activeId) {
        return chat;
      }

      const lastId = chat.messages.at(-1)?.id ?? 0;

      const message: ChatMessage = {
        id: lastId + 1,
        role: 'user',
        content,
      };

      return {
        ...chat,
        title: chat.title || content.slice(0, 48),
        updatedAt: Date.now(),
        messages: [...chat.messages, message],
      };
    });

    this.commit({ ...current, chats });
    return true;
  }

  deleteActiveChat(): void {
    const current = this.state();

    const remaining = current.chats.filter((chat) => chat.id !== current.activeId);

    if (remaining.length === 0) {
      remaining.push(this.createEmptyChat());
    }

    this.commit({
      version: 1,
      activeId: remaining[0].id,
      chats: remaining,
    });
  }

  private createEmptyChat(): ChatConversation {
    const now = Date.now();

    const id = globalThis.crypto?.randomUUID?.() ?? `${now}-${Math.random().toString(36).slice(2)}`;

    return {
      id,
      title: '',
      createdAt: now,
      updatedAt: now,
      messages: [],
    };
  }

  private createInitialState(): ChatState {
    const chat = this.createEmptyChat();

    return {
      version: 1,
      activeId: chat.id,
      chats: [chat],
    };
  }

  private restore(): ChatState | null {
    try {
      const raw = this.document.defaultView?.localStorage.getItem(STORAGE_KEY);

      if (!raw) {
        return null;
      }

      const parsed: unknown = JSON.parse(raw);

      if (
        !isObject(parsed) ||
        parsed['version'] !== 1 ||
        !Array.isArray(parsed['chats']) ||
        parsed['chats'].length === 0 ||
        !parsed['chats'].every(isChat)
      ) {
        return null;
      }

      const chats: ChatConversation[] = parsed['chats'];

      const activeId =
        typeof parsed['activeId'] === 'string' &&
        chats.some((chat) => chat.id === parsed['activeId'])
          ? parsed['activeId']
          : chats[0].id;

      return {
        version: 1,
        activeId,
        chats,
      };
    } catch {
      return null;
    }
  }

  private commit(next: ChatState): void {
    this.state.set(next);
    this.persist();
  }

  private persist(): void {
    try {
      this.document.defaultView?.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state()));

      this.saveError.set(false);
    } catch {
      this.saveError.set(true);
    }
  }
}
