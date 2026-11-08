import { Component, inject } from '@angular/core';

import { ChatView } from '../chat/chat-view/chat-view';
import { MiningView } from '../mining/mining-view';
import { AiLabView } from '../ai-lab/ai-lab-view';

import { ModuleNavigationService } from '../../core/services/module-navigation.service';

@Component({
  selector: 'app-workspace-tabs',
  imports: [ChatView, MiningView, AiLabView],
  templateUrl: './workspace-tabs.html',
  styleUrl: './workspace-tabs.scss',
})
export class WorkspaceTabs {
  readonly navigation = inject(ModuleNavigationService);
}
