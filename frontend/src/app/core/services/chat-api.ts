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
    readonly requestId?: string,
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
      try {
        response = await bridge(request);
      } catch {
        throw new ChatApiError(0, 'BACKEND_UNAVAILABLE');
      }
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
      case 'modelStatus':
        method = 'GET';
        url = `${base}/model-status`;
        break;
      case 'list':
        method = 'GET';
        url = base;
        break;
      case 'create':
        method = 'POST';
        url = base;
        body = { title: request.title };
        break;
      case 'get':
        method = 'GET';
        url = `${base}/${id}`;
        break;
      case 'messages':
        method = 'GET';
        url = `${base}/${id}/messages`;
        break;
      case 'send':
        method = 'POST';
        url = `${base}/${id}/messages`;
        body = { content: request.content };
        break;
      case 'rename':
        method = 'PATCH';
        url = `${base}/${id}`;
        body = { title: request.title };
        break;
      case 'delete':
        method = 'DELETE';
        url = `${base}/${id}`;
        break;
    }
    try {
      return await browserApi<T>(method, url, body, signal ? { signal } : {});
    } catch (error) {
      if (error instanceof BrowserApiError) {
        throw new ChatApiError(error.status, error.message, error.requestId);
      }

      // Anulowane GET nie oznacza awarii backendu.
      // ChatStore ignoruje odpowiedzi z nieaktualnych żądań.
      if (signal?.aborted) {
        throw error;
      }

      // Nie przekazujemy surowych wyjątków do UI.
      throw new ChatApiError(0, 'BACKEND_UNAVAILABLE');
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
  // JARVIS_CHAT_NATIVE_SSE_4C_V1
  /** SSE over same-origin proxy. Angular never reads the server session token. */
  async sendStream(id: string, content: string, requestId: string,
      onDelta: (text: string) => void, signal: AbortSignal): Promise<ApiChatTurn | null> {
    const url = `/api/chats/${encodeURIComponent(id)}/messages/stream?requestId=${encodeURIComponent(requestId)}`;
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'Accept': 'text/event-stream' },
        body: JSON.stringify({ content }), signal,
      });
    } catch (error) {
      if (signal.aborted) throw error;
      throw new ChatApiError(0, 'BACKEND_UNAVAILABLE');
    }
    if (!response.ok || !response.body) throw new ChatApiError(response.status, 'STREAM_UNAVAILABLE');
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let result: ApiChatTurn | null = null;
    const consume = (frame: string): void => {
      const lines = frame.split(/\r?\n/);
      const event = lines.find(line => line.startsWith('event: '))?.slice(7);
      const payload = lines.filter(line => line.startsWith('data: ')).map(line => line.slice(6)).join('\n');
      if (!event || !payload) return;
      if (event === 'delta') onDelta(JSON.parse(payload) as string);
      if (event === 'done') result = JSON.parse(payload) as ApiChatTurn;
      if (event === 'error') throw new ChatApiError(502, 'STREAM_FAILED');
    };
    try {
      while (true) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
        let boundary: number;
        while ((boundary = buffer.indexOf('\n\n')) >= 0) {
          const frame = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          consume(frame);
        }
        if (done) break;
      }
      if (buffer.trim()) consume(buffer);
    } finally { reader.releaseLock(); }
    if (!signal.aborted && !result) throw new ChatApiError(502, 'STREAM_INTERRUPTED');
    return result;
  }

  async cancelStream(id: string, requestId: string): Promise<void> {
    // A cancellation request never needs to expose private content or a token.
    const response = await fetch(`/api/chats/${encodeURIComponent(id)}/messages/stream/cancel?requestId=${encodeURIComponent(requestId)}`,
      { method: 'POST', credentials: 'same-origin' });
    if (!response.ok) throw new ChatApiError(response.status, 'CANCEL_FAILED');
  }

  rename(id: string, title: string): Promise<ApiConversation> {
    return this.request<ApiConversation>({ operation: 'rename', id, title });
  }
  async delete(id: string): Promise<void> {
    await this.request<null>({ operation: 'delete', id });
  }
}
