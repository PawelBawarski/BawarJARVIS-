import { ConnectivityToolbar } from '../../shared/ui/connectivity-toolbar/connectivity-toolbar';
import { Component, inject } from '@angular/core';
import { ModuleNavigationService } from '../../core/services/module-navigation.service';

import { TranslatePipe } from '../../shared/pipes/translate.pipe';
import { ChatHistory } from '../../features/chat/chat-history/chat-history';
@Component({
  selector: 'app-sidebar',
  imports: [ConnectivityToolbar, TranslatePipe, ChatHistory],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
})
export class Sidebar {
  readonly navigation = inject(ModuleNavigationService);
}
