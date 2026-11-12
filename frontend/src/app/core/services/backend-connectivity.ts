import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, NgZone, inject, signal } from '@angular/core';

export type BackendConnectionState = 'checking' | 'reachable' | 'unavailable';

/** Checks this application's LOCAL Spring Boot backend, not general internet connectivity. */
@Injectable({ providedIn: 'root' })
export class BackendConnectivityService {
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly zone = inject(NgZone);
  readonly status = signal<BackendConnectionState>('checking');
  private pending: Promise<void> | null = null;
  private controller: AbortController | null = null;
  private disposed = false;

  constructor() {
    const win = this.document.defaultView;
    if (!win) { this.status.set('unavailable'); return; }

    const onVisibility = (): void => {
      if (!this.document.hidden) void this.check();
    };
    const onConnectionChange = (): void => { void this.check(); };
    this.document.addEventListener('visibilitychange', onVisibility);
    win.addEventListener('online', onConnectionChange);
    win.addEventListener('offline', onConnectionChange);
    // Don't keep the app or Angular test fixtures unstable with an in-zone interval.
    const interval = this.zone.runOutsideAngular(() => win.setInterval(() => {
      if (!this.document.hidden) void this.check();
    }, 30_000));
    this.destroyRef.onDestroy(() => {
      this.disposed = true;
      win.clearInterval(interval);
      this.document.removeEventListener('visibilitychange', onVisibility);
      win.removeEventListener('online', onConnectionChange);
      win.removeEventListener('offline', onConnectionChange);
      this.controller?.abort();
    });
    void this.check();
  }

  async check(): Promise<void> {
    if (this.pending) return this.pending;
    if (this.disposed) return;
    const controller = new AbortController();
    this.controller = controller;
    this.status.set('checking');

    const job = (async () => {
      // This is a *read-only* health check; no token is visible to Angular.
      const timer = setTimeout(() => controller.abort(), 3_500);
      try {
        const response = await fetch('/api/security/health', {
          method: 'GET',
          cache: 'no-store',
          credentials: 'same-origin',
          signal: controller.signal,
        });
        if (!response.ok) {
          if (!this.disposed) this.status.set('unavailable');
          return;
        }
        const body: unknown = await response.json();
        const healthy = typeof body === 'object' && body !== null &&
          'status' in body && body.status === 'UP';
        if (!this.disposed) this.status.set(healthy ? 'reachable' : 'unavailable');
      } catch {
        if (!this.disposed) this.status.set('unavailable');
      } finally {
        clearTimeout(timer);
        if (this.controller === controller) this.controller = null;
      }
    })();
    this.pending = job;
    try { await job; }
    finally { if (this.pending === job) this.pending = null; }
  }
}
