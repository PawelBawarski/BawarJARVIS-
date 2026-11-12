import { browserApi, BrowserApiError } from './browser-api';
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
export interface ApiModelStatus {
  readonly model: string;
  readonly ready: boolean;
}
export interface ApiChatTurn {
  readonly userMessage: ApiMessage;
  readonly assistantMessage: ApiMessage;
}
export type ChatApiRequest =
  | { operation: 'modelStatus' }
  | { operation: 'list' }
  | { operation: 'create'; title: string }
  | { operation: 'get'; id: string }
  | { operation: 'messages'; id: string }
  | { operation: 'send'; id: string; content: string }
  | { operation: 'rename'; id: string; title: string }
  | { operation: 'delete'; id: string };
export type ChatApiResult =
  { ok: true; status: number; data: unknown } | { ok: false; status: number; error: string };

export class ChatApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ChatApiError';
  }
}

@Injectable({ providedIn: 'root' })
export class ChatApiService {
  private async request<T>(request: ChatApiRequest, signal?: AbortSignal): Promise<T> {
    const bridge = window.jarvisDesktop?.chatApi;
    if (bridge) {
      let response: ChatApiResult;
      try { response = await bridge(request); }
      catch { throw new ChatApiError(0, 'BACKEND_UNAVAILABLE'); }
      if (!response.ok) throw new ChatApiError(response.status, response.error);
      return response.data as T;
    }

    // Web-first. Browser never sees or sends JARVIS_SESSION_TOKEN.
    const base = '/api/chats';
    const id = 'id' in request ? encodeURIComponent(request.id) : '';
    let method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
    let url: string;
    let body: unknown = undefined;
    switch (request.operation) {
      case 'modelStatus': method = 'GET'; url = `${base}/model-status`; break;
      case 'list': method = 'GET'; url = base; break;
      case 'create': method = 'POST'; url = base; body = { title: request.title }; break;
      case 'get': method = 'GET'; url = `${base}/${id}`; break;
      case 'messages': method = 'GET'; url = `${base}/${id}/messages`; break;
      case 'send': method = 'POST'; url = `${base}/${id}/messages`; body = { content: request.content }; break;
      case 'rename': method = 'PATCH'; url = `${base}/${id}`; body = { title: request.title }; break;
      case 'delete': method = 'DELETE'; url = `${base}/${id}`; break;
    }
    try { return await browserApi<T>(method, url, body, signal ? { signal } : {}); }
    catch (error) {
      if (error instanceof BrowserApiError) throw new ChatApiError(error.status, error.message);
      throw error;
    }
  }

  modelStatus(): Promise<ApiModelStatus> {
    return this.request<ApiModelStatus>({ operation: 'modelStatus' });
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
  messages(id: string, signal?: AbortSignal): Promise<ApiMessage[]> {
    return this.request<ApiMessage[]>({ operation: 'messages', id }, signal);
  }
  send(id: string, content: string): Promise<ApiChatTurn> {
    return this.request<ApiChatTurn>({ operation: 'send', id, content });
  }
  rename(id: string, title: string): Promise<ApiConversation> {
    return this.request<ApiConversation>({ operation: 'rename', id, title });
  }
  async delete(id: string): Promise<void> {
    await this.request<null>({ operation: 'delete', id });
  }
}
