export type ChatRole = 'user' | 'assistant';

export interface ChatMessage {
  readonly id: string; // BE 11.3 returns a UUID, not a sequence-local integer.
  readonly role: ChatRole;
  readonly content: string;
}
