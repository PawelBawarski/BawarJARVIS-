import { Component, inject, signal } from '@angular/core';

import { ChatStore } from '../../../core/services/chat-store';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { ModuleNavigationService } from '../../../core/services/module-navigation.service';

@Component({
  selector: 'app-chat-history',
  imports: [TranslatePipe],
  templateUrl: './chat-history.html',
  styleUrl: './chat-history.scss',
})
export class ChatHistory {
  readonly store = inject(ChatStore);

  private readonly navigation = inject(ModuleNavigationService);

  readonly editingId = signal('');
  readonly editingTitle = signal('');

  selectChat(id: string): void {
    this.store.selectChat(id);
    this.navigation.select('chat');
  }

  createChat(): void {
    this.store.newChat();
    this.navigation.select('chat');
  }

  startRename(id: string, currentTitle: string, event?: Event): void {
    event?.stopPropagation();

    this.editingId.set(id);
    this.editingTitle.set(currentTitle || 'Nowa rozmowa');
  }

  cancelRename(): void {
    this.editingId.set('');
    this.editingTitle.set('');
  }

  updateEditingTitle(value: string): void {
    this.editingTitle.set(value);
  }

  async saveRename(id: string): Promise<void> {
    const title = this.editingTitle().trim();

    if (!title || title.length > 200) {
      return;
    }

    const success = await this.store.renameChat(id, title);

    if (success) {
      this.cancelRename();
    }
  }

  async deleteChat(id: string, event?: Event): Promise<void> {
    event?.stopPropagation();

    if (this.store.activeId() !== id) {
      this.store.selectChat(id);
    }

    await this.store.removeActiveChat();
  }
}
