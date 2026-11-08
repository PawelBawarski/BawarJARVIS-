import { Injectable, signal } from '@angular/core';

export type BackendStatus =
  | 'checking'
  | 'reachable'
  | 'authenticated'
  | 'unavailable';

// The bridge exposes a narrow method, not a token or a generic HTTP client.
type DesktopBridge = {
  checkPrivateHealth(): Promise<unknown>;
};

type JarvisBrowserWindow = Window & {
  jarvisDesktop?: DesktopBridge;
};

@Injectable({ providedIn: 'root' })
export class SecurityDiagnosticsService {
  readonly backendStatus = signal<BackendStatus>('checking');

  async checkBackend(): Promise<void> {
    this.backendStatus.set('checking');

    const desktopBridge = typeof window !== 'undefined'
      ? (window as JarvisBrowserWindow).jarvisDesktop
      : undefined;

    // Desktop: only the fixed IPC health check can establish authentication.
    if (desktopBridge) {
      try {
        const result: unknown = await desktopBridge.checkPrivateHealth();
        const isAuthenticated =
          typeof result === 'object' &&
          result !== null &&
          'status' in result &&
          result.status === 'authenticated';

        this.backendStatus.set(
          isAuthenticated ? 'authenticated' : 'unavailable'
        );
      } catch {
        this.backendStatus.set('unavailable');
      }
      return;
    }

    // Browser development mode: public endpoint only, no authentication claim.
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
      const isReachable =
        typeof body === 'object' &&
        body !== null &&
        'status' in body &&
        body.status === 'UP';

      this.backendStatus.set(isReachable ? 'reachable' : 'unavailable');
    } catch {
      this.backendStatus.set('unavailable');
    }
  }
}
