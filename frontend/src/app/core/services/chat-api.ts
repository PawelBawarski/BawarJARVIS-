import { Injectable } from '@angular/core';

/** Types are the strict JSON contract of BE 11.3. No session token is ever sent to Angular. */
export interface ApiConversation {
  readonly id: string;
  readonly title: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}
export interface ApiMessage {
  readonly id: string;
  readonly conversationId: string;
  readonly role: 'USER' | 'ASSISTANT' | 'SYSTEM';
  readonly content: string;
  readonly createdAt: string;
  readonly order: number;
}
export interface ApiChatTurn {
  readonly userMessage: ApiMessage;
  readonly assistantMessage: ApiMessage;
}
export type ChatApiRequest =
  | { operation: 'list' }
  | { operation: 'create'; title: string }
  | { operation: 'get'; id: string }
  | { operation: 'messages'; id: string }
  | { operation: 'send'; id: string; content: string }
  | { operation: 'delete'; id: string };
export type ChatApiResult =
  | { ok: true; status: number; data: unknown }
  | { ok: false; status: number; error: string };

export class ChatApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = 'ChatApiError';
  }
}

@Injectable({ providedIn: 'root' })
export class ChatApiService {
  private async request<T>(request: ChatApiRequest): Promise<T> {
    const bridge = window.jarvisDesktop?.chatApi;
    if (!bridge) throw new ChatApiError(0, 'DESKTOP_BRIDGE_UNAVAILABLE');
    let response: ChatApiResult;
    try {
      response = await bridge(request);
    } catch {
      throw new ChatApiError(0, 'BACKEND_UNAVAILABLE');
    }
    if (!response.ok) throw new ChatApiError(response.status, response.error);
    return response.data as T;
  }

  list(): Promise<ApiConversation[]> {
    return this.request<ApiConversation[]>({ operation: 'list' });
  }
  create(title = 'Nowa rozmowa'): Promise<ApiConversation> {
    return this.request<ApiConversation>({ operation: 'create', title });
  }
  get(id: string): Promise<ApiConversation> {
    return this.request<ApiConversation>({ operation: 'get', id });
  }
  messages(id: string): Promise<ApiMessage[]> {
    return this.request<ApiMessage[]>({ operation: 'messages', id });
  }
  send(id: string, content: string): Promise<ApiChatTurn> {
    return this.request<ApiChatTurn>({ operation: 'send', id, content });
  }
  async delete(id: string): Promise<void> {
    await this.request<null>({ operation: 'delete', id });
  }
}
