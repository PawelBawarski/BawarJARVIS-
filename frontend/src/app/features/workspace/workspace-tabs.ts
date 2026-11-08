import { Component, inject } from '@angular/core';

import { ChatView } from '../chat/chat-view/chat-view';
import { MiningView } from '../mining/mining-view';
import { AiLabView } from '../ai-lab/ai-lab-view';

import { ModuleNavigationService } from '../../core/services/module-navigation.service';
import { SecurityDashboard } from '../security/security-dashboard/security-dashboard';
@Component({
  selector: 'app-workspace-tabs',
  imports: [ChatView, MiningView, AiLabView, SecurityDashboard],
  templateUrl: './workspace-tabs.html',
  styleUrl: './workspace-tabs.scss',
})
export class WorkspaceTabs {
  readonly navigation = inject(ModuleNavigationService);
}
