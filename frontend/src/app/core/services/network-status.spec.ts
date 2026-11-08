import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { NetworkStatusService } from './network-status';

describe('NetworkStatusService', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('reports unverified in a browser instead of falsely claiming internet', async () => {
    const service = TestBed.inject(NetworkStatusService);
    await service.refresh();
    expect(['unverified', 'offline']).toContain(service.status());
  });

  it('returns offline when the browser reports network disconnected', async () => {
    const service = TestBed.inject(NetworkStatusService);
    const descriptor = Object.getOwnPropertyDescriptor(window.navigator, 'onLine');
    Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: false });
    try {
      await service.refresh();
      expect(service.isOffline()).toBe(true);
    } finally {
      if (descriptor) {
        Object.defineProperty(window.navigator, 'onLine', descriptor);
      } else {
        delete (window.navigator as unknown as Record<string, unknown>)['onLine'];
      }
    }
  });
});
