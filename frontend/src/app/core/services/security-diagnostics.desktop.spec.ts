import { Injectable, signal } from '@angular/core';

export type BackendStatus = 'checking' | 'reachable' | 'authenticated' | 'unavailable';

@Injectable({
  providedIn: 'root',
})
export class SecurityDiagnosticsService {
  readonly backendStatus = signal<BackendStatus>('checking');

  async checkBackend(): Promise<void> {
    this.backendStatus.set('checking');

    // Electron — żądanie przez kontrolowany most IPC.
    if (typeof window !== 'undefined' && window.jarvisDesktop) {
      try {
        const result = await window.jarvisDesktop.checkPrivateHealth();

        this.backendStatus.set(result.status === 'authenticated' ? 'authenticated' : 'unavailable');
      } catch {
        this.backendStatus.set('unavailable');
      }

      return;
    }

    // Zwykła przeglądarka developerska — tylko publiczny health.
    try {
      const response = await fetch('/api/security/health', {
        method: 'GET',
        cache: 'no-store',
        credentials: 'same-origin',
        signal: AbortSignal.timeout(3000),
      });

      if (!response.ok) {
        this.backendStatus.set('unavailable');
        return;
      }

      const body: unknown = await response.json();

      const reachable =
        typeof body === 'object' && body !== null && 'status' in body && body.status === 'UP';

      this.backendStatus.set(reachable ? 'reachable' : 'unavailable');
    } catch {
      this.backendStatus.set('unavailable');
    }
  }
}
