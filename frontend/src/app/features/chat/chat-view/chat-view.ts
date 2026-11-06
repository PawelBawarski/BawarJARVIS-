import { Component, signal } from '@angular/core';
import { ChatMessage } from '../models/chat-message';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-chat-view',
  templateUrl: './chat-view.html',
  styleUrl: './chat-view.scss',
  imports: [TranslatePipe],
})
export class ChatView {
  readonly draft = signal('');

  readonly messages = signal<ChatMessage[]>([
    {
      id: 1,
      role: 'assistant',
      content: 'Cześć! Jestem Jarvis. Jak mogę Ci pomóc?',
    },
  ]);

  private nextId = 2;

  sendMessage(): void {
    const content = this.draft().trim();

    if (!content) {
      return;
    }

    const userMessage: ChatMessage = {
      id: this.nextId++,
      role: 'user',
      content,
    };

    const assistantMessage: ChatMessage = {
      id: this.nextId++,
      role: 'assistant',
      content: 'Otrzymałem wiadomość. Mój model AI zostanie podłączony w kolejnym etapie.',
    };

    this.messages.update((current) => [...current, userMessage, assistantMessage]);

    this.draft.set('');
  }
}
