import { DOCUMENT } from '@angular/common';
import { Component, DestroyRef, inject, signal } from '@angular/core';

import { Sidebar } from '../sidebar/sidebar';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';
import { WorkspaceTabs } from '../../features/workspace/workspace-tabs';
import { ModuleSwitcher } from '../module-switcher/module-switcher';
import { SettingsDialog } from '../settings-dialog/settings-dialog';
import { RadioPanel } from '../radio-panel/radio-panel';
@Component({
  selector: 'app-app-shell',
  imports: [Sidebar, WorkspaceTabs, ModuleSwitcher, SettingsDialog, RadioPanel, TranslatePipe],
  templateUrl: './app-shell.html',
  styleUrl: './app-shell.scss',
  host: {
    '(document:keydown.escape)': 'onEscape()',
  },
})
export class AppShell {
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);

  readonly isMobile = signal(false);
  readonly sidebarOpen = signal(true);

  constructor() {
    const mediaQuery = this.document.defaultView?.matchMedia?.('(max-width: 760px)');

    if (!mediaQuery) {
      return;
    }

    this.isMobile.set(mediaQuery.matches);
    this.sidebarOpen.set(!mediaQuery.matches);

    const onResize = (event: MediaQueryListEvent): void => {
      this.isMobile.set(event.matches);
      this.sidebarOpen.set(!event.matches);
    };

    mediaQuery.addEventListener('change', onResize);

    this.destroyRef.onDestroy(() => {
      mediaQuery.removeEventListener('change', onResize);
    });
  }

  toggleSidebar(): void {
    this.sidebarOpen.update((open) => !open);
  }

  closeSidebar(): void {
    if (this.isMobile()) {
      this.sidebarOpen.set(false);
    }
  }

  onEscape(): void {
    this.closeSidebar();
  }
}
