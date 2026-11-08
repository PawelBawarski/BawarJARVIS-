import { Component, signal } from '@angular/core';

import { MiningView } from '../mining/mining-view';
import { AiLabView } from '../ai-lab/ai-lab-view';

import { TranslatePipe } from '../../shared/pipes/translate.pipe';
import { ChatView } from '../chat/chat-view/chat-view';

export type WorkspaceTab = 'chat' | 'mining' | 'lab';

@Component({
  selector: 'app-workspace-tabs',
  imports: [ChatView, MiningView, AiLabView, TranslatePipe],
  templateUrl: './workspace-tabs.html',
  styleUrl: './workspace-tabs.scss',
})
export class WorkspaceTabs {
  readonly activeTab = signal<WorkspaceTab>('chat');

  selectTab(tab: WorkspaceTab): void {
    this.activeTab.set(tab);
  }
}
