import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InternetPreferenceService } from './internet-preference';

// Angular's Vitest builder does not support vi.mock() for relative imports.
// Stub the transport boundary used by browserApi instead.
const response = (internetEnabled: boolean) => ({
  ok: true,
  status: 200,
  json: async () => ({ internetEnabled }),
});

describe('InternetPreferenceService (PostgreSQL-backed)', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    TestBed.resetTestingModule();
  });

  it('loads saved true state from the backend', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response(true));
    vi.stubGlobal('fetch', fetchMock);

    const service = TestBed.inject(InternetPreferenceService);
    expect(service.enabled()).toBe(false);
    await service.load();

    expect(service.enabled()).toBe(true);
    expect(service.loading()).toBe(false);
    expect(service.error()).toBe(false);
    expect(fetchMock).toHaveBeenCalledWith('/api/chats/web-settings',
      expect.objectContaining({ method: 'GET', credentials: 'same-origin' }));
  });

  it('restores a previously disabled setting', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response(false));
    vi.stubGlobal('fetch', fetchMock);

    const service = TestBed.inject(InternetPreferenceService);
    await service.load();

    expect(service.enabled()).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not claim a failed database write succeeded', async () => {
    // 403 is not retried: a failed PUT cannot be safely replayed.
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false, status: 403,
      headers: { get: () => null },
      json: async () => ({ code: 'FORBIDDEN' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const service = TestBed.inject(InternetPreferenceService);
    await service.update(true);

    expect(service.enabled()).toBe(false);
    expect(service.error()).toBe(true);
    expect(service.saving()).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('saves the boolean preference through the backend endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response(true));
    vi.stubGlobal('fetch', fetchMock);

    const service = TestBed.inject(InternetPreferenceService);
    await service.update(true);

    expect(service.enabled()).toBe(true);
    expect(service.error()).toBe(false);
    expect(service.saving()).toBe(false);
    expect(fetchMock).toHaveBeenCalledWith('/api/chats/web-settings',
      expect.objectContaining({
        method: 'PUT',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ internetEnabled: true }),
      }));
  });
});
