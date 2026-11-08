import { Component, inject } from '@angular/core';

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

  selectChat(id: string): void {
    this.store.selectChat(id);
    this.navigation.select('chat');
  }

  createChat(): void {
    this.store.newChat();
    this.navigation.select('chat');
  }
}
