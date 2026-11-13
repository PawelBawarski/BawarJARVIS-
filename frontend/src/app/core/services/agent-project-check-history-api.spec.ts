import { afterEach, describe, expect, it, vi } from 'vitest';
import { AgentProjectCheckHistoryApiService } from './agent-project-check-history-api';

describe('19.5 history API', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('reads authenticated local metadata using GET; never writes', async () => {
    const mock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => [] });
    vi.stubGlobal('fetch', mock);
    const api = new AgentProjectCheckHistoryApiService();
    expect(await api.list(1000)).toEqual([]);
    expect(mock).toHaveBeenCalledTimes(1);
    expect(mock.mock.calls[0][0]).toBe('/api/agent/project-checks/history?limit=50');
    expect(mock.mock.calls[0][1].method).toBe('GET');
    expect(mock.mock.calls[0][1].credentials).toBe('same-origin');
  });
});
