import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AgentWorkspaceApplyApiService } from './agent-workspace-apply-api';

describe('AgentWorkspaceApplyApiService — no arbitrary paths or code from renderer', () => {
  const invoke = vi.fn();
  beforeEach(() => {
    vi.resetAllMocks();
    (window as any).jarvisDesktop = { agentWorkspaceApply: invoke };
    TestBed.configureTestingModule({});
  });
  it('sends only a test-issued grant ID for apply', async () => {
    invoke.mockResolvedValue({status:'cancelled',message:'No write'});
    const service = TestBed.inject(AgentWorkspaceApplyApiService);
    await service.apply('123456');
    expect(invoke).toHaveBeenCalledWith({operation:'apply',grantId:'123456'});
  });
  it('sends only a saved deployment ID to rollback', async () => {
    invoke.mockResolvedValue({status:'rolled_back',message:'Restored'});
    await TestBed.inject(AgentWorkspaceApplyApiService).rollback('deployment1');
    expect(invoke).toHaveBeenCalledWith({operation:'rollback',deploymentId:'deployment1'});
  });
});
