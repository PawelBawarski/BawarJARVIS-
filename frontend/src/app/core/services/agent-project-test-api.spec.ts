import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AgentProjectTestApiService } from './agent-project-test-api';

const patch = { relativePath: 'frontend/src/app/counter.ts', original: 'const x = 1;',
  proposed: 'const x = 2;', diff: '-const x = 1;\n+const x = 2;', notice: 'Nie zapisano' };

describe('AgentProjectTestApiService', () => {
  afterEach(() => { delete (window as any).jarvisDesktop; });
  it('reports missing Electron bridge instead of accessing files', async () => {
    TestBed.configureTestingModule({});
    const api = TestBed.inject(AgentProjectTestApiService);
    expect(api.available).toBe(false);
    await expect(api.run(patch)).rejects.toThrow('Electron');
  });
  it('calls one fixed operation with source and proposal only', async () => {
    const call = vi.fn().mockResolvedValue({status:'passed',scope:'frontend',message:'OK'});
    (window as any).jarvisDesktop = {agentProjectTest:call};
    TestBed.configureTestingModule({});
    const api = TestBed.inject(AgentProjectTestApiService);
    await api.run(patch);
    expect(call).toHaveBeenCalledWith({ operation:'test',
      relativePath:patch.relativePath, original:patch.original, proposed:patch.proposed });
  });
});
