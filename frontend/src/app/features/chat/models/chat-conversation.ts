import { ChatMessage } from './chat-message';

export interface ChatConversation {
  readonly id: string;
  readonly title: string;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly messages: readonly ChatMessage[];
}
