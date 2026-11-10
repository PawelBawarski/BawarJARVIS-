import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AgentProposalApiService } from './agent-proposal-api';

describe('AgentProposalApiService uses only desktop IPC', () => {
  afterEach(() => { delete (window as unknown as { jarvisDesktop?: unknown }).jarvisDesktop; });

  it('does not use an unauthenticated browser REST fallback', async () => {
    TestBed.configureTestingModule({});
    const api = TestBed.inject(AgentProposalApiService);
    expect(api.available).toBe(false);
    await expect(api.list()).rejects.toThrow('Electronie');
  });

  it('forwards only the fixed approve operation', async () => {
    const call = vi.fn().mockResolvedValue({ ok: true, status: 200, data: { status: 'APPROVED' } });
    (window as unknown as { jarvisDesktop?: unknown }).jarvisDesktop = { agentProposalApi: call };
    TestBed.configureTestingModule({});
    const api = TestBed.inject(AgentProposalApiService);
    await api.approve('8ef71522-27d0-4f9b-9bb3-d0245b9bf440');
    expect(call).toHaveBeenCalledWith({ operation: 'decide', id: '8ef71522-27d0-4f9b-9bb3-d0245b9bf440', decision: 'APPROVED' });
  });

  it('sends only user-selected excerpts through the existing private bridge', async () => {
    const call = vi.fn().mockResolvedValue({ ok: true, status: 201, data: { status: 'PENDING' } });
    (window as unknown as { jarvisDesktop?: unknown }).jarvisDesktop = { agentProposalApi: call };
    TestBed.configureTestingModule({});
    const api = TestBed.inject(AgentProposalApiService);
    const sources = [{ relativePath: 'frontend/src/app/app.ts', content: 'export const name = "Jarvis";' }];
    await api.generate('Przygotuj plan', sources);
    expect(call).toHaveBeenCalledWith({ operation: 'generate', task: 'Przygotuj plan', sources });
  });

});
