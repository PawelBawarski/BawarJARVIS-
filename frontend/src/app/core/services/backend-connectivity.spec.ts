import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BackendConnectivityService } from './backend-connectivity';

describe('18.9 — local backend reachability', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('only reports reachable after a successful local health response', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ status: 'UP' }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const service = TestBed.inject(BackendConnectivityService);
    await service.check();
    expect(service.status()).toBe('reachable');
    expect(fetchMock).toHaveBeenCalledWith('/api/security/health', expect.objectContaining({
      method: 'GET', credentials: 'same-origin', cache: 'no-store',
    }));
    expect(fetchMock.mock.calls[0][1]).not.toHaveProperty('headers');
  });

  it('transitions to unavailable on failure and can recover after a manual check', async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new TypeError('offline'))
      .mockResolvedValueOnce({ok: true, json: async () => ({status: 'UP'})});
    vi.stubGlobal('fetch', fetchMock);
    const service = TestBed.inject(BackendConnectivityService);
    await service.check();
    expect(service.status()).toBe('unavailable');
    await service.check();
    expect(service.status()).toBe('reachable');
  });

  it('coalesces concurrent checks instead of sending duplicate health requests', async () => {
    let resolve!: (value: unknown) => void;
    const fetchMock = vi.fn().mockReturnValue(new Promise(done => {resolve = done;}));
    vi.stubGlobal('fetch', fetchMock);
    const service = TestBed.inject(BackendConnectivityService);
    const check = service.check();
    const secondCheck = service.check();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    resolve({ok: true, json: async () => ({status: 'UP'})});
    await Promise.all([check, secondCheck]);
    expect(service.status()).toBe('reachable');
  });
});
