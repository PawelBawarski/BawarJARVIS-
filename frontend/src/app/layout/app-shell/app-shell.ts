import { Component } from '@angular/core';
import { Sidebar } from '../sidebar/sidebar';
import { ChatView } from '../../features/chat/chat-view/chat-view';

@Component({
  selector: 'app-app-shell',
  imports: [Sidebar, ChatView],
  templateUrl: './app-shell.html',
  styleUrl: './app-shell.scss',
})
export class AppShell {}
