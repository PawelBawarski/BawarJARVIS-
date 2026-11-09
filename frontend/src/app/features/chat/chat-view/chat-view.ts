import { Component, inject, signal } from '@angular/core';
import { ChatStore } from '../../../core/services/chat-store';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-chat-view',
  templateUrl: './chat-view.html',
  styleUrl: './chat-view.scss',
  imports: [TranslatePipe],
})
export class ChatView {
  readonly store = inject(ChatStore);
  readonly draft = signal('');
  readonly messages = this.store.messages;

  async sendMessage(): Promise<void> {
    const text = this.draft().trim();
    if (!text || this.store.sending()) return;
    if (await this.store.sendMessage(text)) this.draft.set('');
  }
  newChat(): void { this.store.newChat(); }
  deleteChat(): void { this.store.deleteActiveChat(); }
}
