
import { Component, inject } from '@angular/core';

import { NetworkStatusService } from '../../../core/services/network-status';
import { TranslatePipe } from '../../pipes/translate.pipe';

const RELEASES =
  'https://github.com/PawelBawarski/BawarJARVIS-/releases';

const PROJECT =
  'https://github.com/PawelBawarski/BawarJARVIS-';

@Component({
  selector: 'app-connectivity-toolbar',
  imports: [TranslatePipe],
  templateUrl: './connectivity-toolbar.html',
  styleUrl: './connectivity-toolbar.scss',
})
export class ConnectivityToolbar {
  readonly network = inject(NetworkStatusService);

  constructor() {
    void this.network.refresh();
  }

  async openInstaller(): Promise<void> {
    if (this.network.isOffline()) return;

    if (window.jarvisDesktop?.openReleasesPage) {
      await window.jarvisDesktop.openReleasesPage();
    } else {
      window.open(RELEASES, '_blank', 'noopener,noreferrer');
    }
  }

  async openBrowser(): Promise<void> {
    if (this.network.isOffline()) return;

    if (window.jarvisDesktop?.openProjectPage) {
      await window.jarvisDesktop.openProjectPage();
    } else {
      window.open(PROJECT, '_blank', 'noopener,noreferrer');
    }
  }
}
