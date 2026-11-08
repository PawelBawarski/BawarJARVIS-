import { Component, computed, inject } from '@angular/core';

import { TranslationService } from '../../../core/services/translation';
import { NetworkStatusService } from '../../../core/services/network-status';
import { TranslatePipe } from '../../pipes/translate.pipe';

@Component({
  selector: 'app-connectivity-toolbar',
  imports: [TranslatePipe],
  templateUrl: './connectivity-toolbar.html',
  styleUrl: './connectivity-toolbar.scss',
})
export class ConnectivityToolbar {
  readonly translation = inject(TranslationService);
  readonly network = inject(NetworkStatusService);

  readonly isOnline = computed(() => this.network.isOnline());
  readonly networkLabel = computed(() =>
    this.isOnline()
      ? this.translation.translate('network.online')
      : this.translation.translate('network.offline'),
  );

  readonly radioDisabled = computed(() => !this.isOnline());

  openInstaller(): void {
    // tutaj zostawiasz swój obecny mechanizm
    console.log('Open installer');
  }

  openBrowser(): void {
    // tutaj zostawiasz swój obecny mechanizm
    console.log('Open browser');
  }
}