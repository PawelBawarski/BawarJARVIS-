import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AgentWorkspaceApply } from './agent-workspace-apply';
import { AgentWorkspaceApplyApiService } from '../../../core/services/agent-workspace-apply-api';

const preview = {relativePath:'frontend/src/app/sample.ts',original:'const x = 1;',proposed:'const x = 2;',diff:'-const x = 1;\n+const x = 2;',notice:'Bez zapisu'};
const passed = {status:'passed' as const, scope:'frontend' as const, message:'OK',grantId:'grant1'};
describe('AgentWorkspaceApply — test gated and user approved', () => {
  const api = {available:true,apply:vi.fn(),rollback:vi.fn(),history:vi.fn()};
  beforeEach(async () => {
    vi.resetAllMocks();
    api.apply.mockResolvedValue({status:'applied',relativePath:preview.relativePath,deploymentId:'deployment1',message:'Zapisano'});
    api.rollback.mockResolvedValue({status:'rolled_back',relativePath:preview.relativePath,message:'Przywrócono'});
    api.history.mockResolvedValue({status:'ok',deployments:[]});
    await TestBed.configureTestingModule({imports:[AgentWorkspaceApply],providers:[{provide:AgentWorkspaceApplyApiService,useValue:api}]}).compileComponents();
  });
  it('never applies before successful test and separate approval', async () => {
    const fixture = TestBed.createComponent(AgentWorkspaceApply);
    fixture.componentRef.setInput('preview',preview);
    fixture.componentRef.setInput('report',{...passed,status:'failed'});
    await fixture.whenStable();
    const button = fixture.nativeElement.querySelector('[data-testid="agent-apply-run"]') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    fixture.componentRef.setInput('report',passed);
    await fixture.whenStable();
    expect(button.disabled).toBe(true);
    expect(api.apply).not.toHaveBeenCalled();
    fixture.componentInstance.confirmed.set(true);
    fixture.detectChanges();
    expect(button.disabled).toBe(false);
    button.click();
    await fixture.whenStable();
    expect(api.apply).toHaveBeenCalledTimes(1);
    expect(api.apply).toHaveBeenCalledWith('grant1');
    expect(fixture.nativeElement.textContent).toContain('Zapisano');
  });
  it('rollback must be explicitly clicked', async () => {
    const fixture=TestBed.createComponent(AgentWorkspaceApply);
    fixture.componentRef.setInput('preview',preview);
    fixture.componentRef.setInput('report',passed);
    await fixture.whenStable();
    fixture.componentInstance.confirmed.set(true);
    await fixture.componentInstance.apply();
    expect(api.rollback).not.toHaveBeenCalled();
    await fixture.componentInstance.rollback();
    expect(api.rollback).toHaveBeenCalledWith('deployment1');
    expect(fixture.componentInstance.deployment()).toBeNull();
  });
  it('a replaced preview has no new authorization without a new passing report', async () => {
    const fixture=TestBed.createComponent(AgentWorkspaceApply);
    fixture.componentRef.setInput('preview',preview);
    fixture.componentRef.setInput('report',passed);
    await fixture.whenStable();
    fixture.componentRef.setInput('preview',{...preview,proposed:'const x = 3;'});
    fixture.componentRef.setInput('report',null);
    await fixture.whenStable();
    fixture.componentInstance.confirmed.set(true);
    expect(fixture.componentInstance.canApply()).toBe(false);
    expect(api.apply).not.toHaveBeenCalled();
  });
});
