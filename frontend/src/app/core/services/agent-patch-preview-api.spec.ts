import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AgentProposalApiService } from './agent-proposal-api';

describe('AgentProposalApiService — stage 16.3 preview uses private Electron bridge', () => {
  afterEach(() => { delete (window as any).jarvisDesktop; });
  it('sends exactly one selected source to fixed preview operation', async () => {
    const call = vi.fn().mockResolvedValue({ ok: true, status: 200, data: { diff: '-x\n+y' } });
    (window as any).jarvisDesktop = { agentProposalApi: call };
    TestBed.configureTestingModule({});
    const api = TestBed.inject(AgentProposalApiService);
    const source = { relativePath: 'frontend/src/app/example.ts', content: 'export const x = 1;' };
    await api.previewPatch('Zmień x', source);
    expect(call).toHaveBeenCalledWith({ operation: 'patch-preview', task: 'Zmień x', source });
  });
  it('refuses a browser without Electron; never calls fetch', async () => {
    TestBed.configureTestingModule({});
    const api = TestBed.inject(AgentProposalApiService);
    expect(api.available).toBe(false);
    await expect(api.previewPatch('Zmień x', { relativePath: 'a.ts', content: 'abc' }))
      .rejects.toThrow('Electronie');
  });
});
