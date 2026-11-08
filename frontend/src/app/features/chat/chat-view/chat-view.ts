import { DOCUMENT } from '@angular/common';
import { Component, inject, signal } from '@angular/core';

import { ChatStore } from '../../../core/services/chat-store';
import { TranslationService } from '../../../core/services/translation';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-chat-view',
  imports: [TranslatePipe],
  templateUrl: './chat-view.html',
  styleUrl: './chat-view.scss',
})
export class ChatView {
  readonly store = inject(ChatStore);
  readonly draft = signal('');

  private readonly document = inject(DOCUMENT);
  private readonly translation = inject(TranslationService);

  sendMessage(): void {
    if (this.store.addUserMessage(this.draft())) {
      this.draft.set('');
    }
  }

  newChat(): void {
    this.store.newChat();
    this.draft.set('');
  }

  deleteChat(): void {
    const confirmed =
      this.document.defaultView?.confirm(this.translation.translate('chat.confirmDelete')) ?? false;

    if (!confirmed) {
      return;
    }

    this.store.deleteActiveChat();
    this.draft.set('');
  }
}
