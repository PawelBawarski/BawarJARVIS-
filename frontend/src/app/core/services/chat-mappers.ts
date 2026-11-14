import type { ApiConversation, ApiMessage } from './chat-api';
import type { ChatConversation } from '../../features/chat/models/chat-conversation';
import type { ChatMessage } from '../../features/chat/models/chat-message';

/** Pure mapping only. PostgreSQL remains the source of truth. */
export function mapMessage(message: ApiMessage): ChatMessage {
  return {
    id: message.id,
    role: message.role === 'USER' ? 'user' : 'assistant',
    content: message.content,
  };
}

export function mapConversation(chat: ApiConversation): ChatConversation {
  return {
    id: chat.id,
    title: chat.title,
    createdAt: Date.parse(chat.createdAt),
    updatedAt: Date.parse(chat.updatedAt),
    messages: [],
  };
}

export function emptyChat(): ChatConversation {
  return { id: '', title: '', createdAt: 0, updatedAt: 0, messages: [] };
}
