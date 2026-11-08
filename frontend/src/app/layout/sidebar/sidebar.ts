import { ConnectivityToolbar } from '../../shared/ui/connectivity-toolbar/connectivity-toolbar';
import { Component } from '@angular/core';

import { TranslatePipe } from '../../shared/pipes/translate.pipe';
import { ChatHistory } from '../../features/chat/chat-history/chat-history';
@Component({
  selector: 'app-sidebar',
  imports: [ConnectivityToolbar, TranslatePipe, ChatHistory],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
})
export class Sidebar {}
