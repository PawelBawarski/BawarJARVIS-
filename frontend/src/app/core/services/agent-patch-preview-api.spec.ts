import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AgentProposalApiService } from './agent-proposal-api';

describe('AgentProposalApiService — patch preview in Electron and web', () => {
  afterEach(() => {
    delete (window as any).jarvisDesktop;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });
  it('sends exactly one selected source to fixed preview operation', async () => {
    const call = vi.fn().mockResolvedValue({ ok: true, status: 200, data: { diff: '-x\n+y' } });
    (window as any).jarvisDesktop = { agentProposalApi: call };
    TestBed.configureTestingModule({});
    const api = TestBed.inject(AgentProposalApiService);
    const source = { relativePath: 'frontend/src/app/example.ts', content: 'export const x = 1;' };
    await api.previewPatch('Zmień x', source);
    expect(call).toHaveBeenCalledWith({ operation: 'patch-preview', task: 'Zmień x', source });
  });
  it('uses same-origin REST in a browser and sends only the approved excerpt', async () => {
    const source = { relativePath: 'a.ts', content: 'abc' };
    const preview = { relativePath: 'a.ts', original: 'abc', proposed: 'abcd', diff: '-abc\n+abcd', notice: 'preview only' };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, status: 200, json: async () => preview,
    });
    vi.stubGlobal('fetch', fetchMock);

    TestBed.configureTestingModule({});
    const api = TestBed.inject(AgentProposalApiService);
    expect(api.available).toBe(true);
    await expect(api.previewPatch('Zmień x', source)).resolves.toEqual(preview);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith('/api/agent/patch-preview', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task: 'Zmień x', source }),
    });
  });
});
