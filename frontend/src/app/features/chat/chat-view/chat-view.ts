import { Component, inject, signal } from '@angular/core';

import { ChatStore } from '../../../core/services/chat-store';
import { TranslationService } from '../../../core/services/translation';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { ConfirmDialogService } from '../../../shared/services/confirm-dialog';

@Component({
  selector: 'app-chat-view',
  imports: [TranslatePipe],
  templateUrl: './chat-view.html',
  styleUrl: './chat-view.scss',
})
export class ChatView {
  readonly store = inject(ChatStore);
  readonly draft = signal('');

  private readonly confirmDialog = inject(ConfirmDialogService);
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

  async deleteChat(): Promise<void> {
    const confirmed = await this.confirmDialog.open({
      title: this.translation.translate('chat.deleteTitle'),
      message: this.translation.translate('chat.deleteDescription'),
      confirmText: this.translation.translate('chat.delete'),
      cancelText: this.translation.translate('common.cancel'),
    });

    if (!confirmed) {
      return;
    }

    this.store.deleteActiveChat();
    this.draft.set('');
  }
}
