import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { Sidebar } from '../sidebar/sidebar';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';
import { WorkspaceTabs } from '../../features/workspace/workspace-tabs';
import { ModuleSwitcher } from '../module-switcher/module-switcher';
import { SettingsDialog } from '../settings-dialog/settings-dialog';
import { RadioPanel } from '../radio-panel/radio-panel';
import { ModuleHelpDialog } from '../../shared/module-help/module-help-dialog';
import { ModuleHelpService } from '../../core/services/module-help.service';
import { ModuleNavigationService } from '../../core/services/module-navigation.service';
import { BackendConnectivityService } from '../../core/services/backend-connectivity';
@Component({
  selector: 'app-app-shell',
  imports: [Sidebar, WorkspaceTabs, ModuleSwitcher, SettingsDialog, RadioPanel, ModuleHelpDialog, TranslatePipe],
  templateUrl: './app-shell.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './app-shell.scss',
  host: {
    '(document:keydown.escape)': 'onEscape()',
  },
})
export class AppShell {
  private readonly document = inject(DOCUMENT);
  readonly help = inject(ModuleHelpService);
  readonly navigation = inject(ModuleNavigationService);
  readonly backend = inject(BackendConnectivityService);
  readonly backendStatusKey = () => `backend.status.${this.backend.status()}`;
  private readonly destroyRef = inject(DestroyRef);
  // Optional only for isolated component tests that render AppShell without Router providers.
  private readonly route = inject(ActivatedRoute, { optional: true });
  private readonly router = inject(Router, { optional: true });

  readonly isMobile = signal(false);
  readonly sidebarOpen = signal(true);

  constructor() {
    if (this.route && this.router) {
      // Browser Back/Forward and direct URL entry are authoritative.
      this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
        const moduleId = params.get('module');
        if (moduleId) this.navigation.select(moduleId);
      });

      // Existing controls (switcher, sidebar, ChatHistory) navigate without recreation.
      effect(() => {
        const moduleId = this.navigation.activeId();
        if (this.route?.snapshot.paramMap.get('module') !== moduleId) {
          void this.router?.navigateByUrl(`/${moduleId}`);
        }
      });
    }

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
