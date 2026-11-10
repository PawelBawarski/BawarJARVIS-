import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AgentSandbox } from './agent-sandbox';
import { AgentSandboxApiService } from '../../../core/services/agent-sandbox-api';

const patch = { relativePath:'frontend/src/app/sample.ts', original:'const x = 1;',
  proposed:'const x = 2;', diff:'-const x = 1;\n+const x = 2;', notice:'Bez zapisu' };

describe('AgentSandbox: manual, syntax-only Docker inspection', () => {
  const service = { available: true, check: vi.fn() };
  beforeEach(async () => {
    vi.resetAllMocks();
    service.check.mockResolvedValue({ status:'passed', language:'.ts', message:'Składnia poprawna' });
    await TestBed.configureTestingModule({ imports:[AgentSandbox], providers:[
      { provide:AgentSandboxApiService, useValue:service },
    ] }).compileComponents();
  });
  it('never invokes check without an explicit user click', async () => {
    const fixture = TestBed.createComponent(AgentSandbox);
    fixture.componentRef.setInput('preview', patch);
    await fixture.whenStable();
    expect(service.check).not.toHaveBeenCalled();
    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('[data-testid="agent-sandbox-check"]')!.click();
    await fixture.whenStable();
    expect(service.check).toHaveBeenCalledTimes(1);
    expect(service.check).toHaveBeenCalledWith(patch);
    expect(fixture.nativeElement.textContent).toContain('Składnia poprawna');
  });
  it('shows an unavailable report and never writes', async () => {
    service.check.mockResolvedValue({status:'unavailable',language:'.ts',message:'Brak obrazu Docker'});
    const fixture = TestBed.createComponent(AgentSandbox);
    fixture.componentRef.setInput('preview', patch);
    await fixture.whenStable();
    await fixture.componentInstance.check();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Brak obrazu Docker');
  });
  it('does not display a stale result for a replaced diff', async () => {
    let resolve!: (x: any) => void;
    service.check.mockReturnValue(new Promise(r => { resolve = r; }));
    const fixture = TestBed.createComponent(AgentSandbox);
    fixture.componentRef.setInput('preview', patch);
    fixture.detectChanges();
    const work = fixture.componentInstance.check();
    fixture.componentRef.setInput('preview', {...patch, proposed: 'const x = 3;'});
    fixture.detectChanges();
    resolve({status:'passed', language:'.ts', message:'Nieaktualne'});
    await work;
    expect(fixture.componentInstance.result()).toBeNull();
  });
});
