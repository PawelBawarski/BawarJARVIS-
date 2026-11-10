import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AgentSandboxApiService } from './agent-sandbox-api';

const patch = { relativePath:'frontend/src/app/sample.ts', original:'const x = 1;',
  proposed:'const x = 2;', diff:'-1\n+2', notice:'Nie zapisano' };
describe('AgentSandboxApiService: fixed Electron operation', () => {
  afterEach(() => delete (window as any).jarvisDesktop);
  it('sends only the reviewed snippet as one fixed operation', async () => {
    const call = vi.fn().mockResolvedValue({status:'passed',language:'.ts',message:'Ok'});
    (window as any).jarvisDesktop = { sandboxCheck:call };
    TestBed.configureTestingModule({});
    await TestBed.inject(AgentSandboxApiService).check(patch);
    expect(call).toHaveBeenCalledWith({operation:'check', relativePath:patch.relativePath,
      original:patch.original, proposed:patch.proposed});
  });
  it('rejects use in a browser without the Electron bridge', async () => {
    TestBed.configureTestingModule({});
    const service = TestBed.inject(AgentSandboxApiService);
    expect(service.available).toBe(false);
    await expect(service.check(patch)).rejects.toThrow('Electron');
  });
});
