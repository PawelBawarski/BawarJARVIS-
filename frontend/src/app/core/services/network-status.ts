import { DOCUMENT } from '@angular/common';
import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';

export type NetworkState = 'checking' | 'online' | 'offline' | 'unverified';

/** Network diagnostics only; not proof that any particular website/stream works. */
@Injectable({ providedIn: 'root' })
export class NetworkStatusService {
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly state = signal<NetworkState>('checking');
  readonly status = this.state.asReadonly();
  readonly isOffline = computed(() => this.state() === 'offline');

  constructor() {
    const win = this.document.defaultView;
    if (!win) {
      this.state.set('unverified');
      return;
    }
    const refresh = () => void this.refresh();
    win.addEventListener('online', refresh);
    win.addEventListener('offline', refresh);
    const interval = win.setInterval(refresh, 45_000);
    this.destroyRef.onDestroy(() => {
      win.removeEventListener('online', refresh);
      win.removeEventListener('offline', refresh);
      win.clearInterval(interval);
    });
    void this.refresh();
  }

  async refresh(): Promise<void> {
    const win = this.document.defaultView;
    if (!win || !win.navigator.onLine) {
      this.state.set('offline');
      return;
    }
    const probe = win.jarvisDesktop?.checkInternet;
    if (!probe) {
      // A browser reporting online is NOT proof of internet connectivity.
      this.state.set('unverified');
      return;
    }
    this.state.set('checking');
    try {
      const result = await probe();
      this.state.set(result.state === 'online' || result.state === 'offline'
        ? result.state : 'unverified');
    } catch {
      this.state.set('unverified');
    }
  }
}
