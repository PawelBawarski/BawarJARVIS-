import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AgentProjectTest } from './agent-project-test';
import { AgentProjectTestApiService } from '../../../core/services/agent-project-test-api';

const patch = { relativePath:'frontend/src/app/sample.ts', original:'const x = 1;',
  proposed:'const x = 2;', diff:'-const x = 1;\n+const x = 2;', notice:'Nie zapisano' };
describe('AgentProjectTest — explicit consent, never applies code', () => {
  const api = { available:true, run:vi.fn() };
  beforeEach(async () => {
    vi.resetAllMocks();
    api.run.mockResolvedValue({ status:'passed', scope:'frontend', message:'ng build, Vitest OK' });
    await TestBed.configureTestingModule({ imports:[AgentProjectTest], providers:[
      { provide:AgentProjectTestApiService, useValue:api },
    ] }).compileComponents();
  });
  it('will not run without a separate explicit user confirmation', async () => {
    const fixture = TestBed.createComponent(AgentProjectTest);
    fixture.componentRef.setInput('preview',patch);
    await fixture.whenStable();
    const button = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('[data-testid="agent-project-test-run"]')!;
    expect(button.disabled).toBe(true);
    expect(api.run).not.toHaveBeenCalled();
    fixture.componentInstance.confirmed.set(true);
    fixture.detectChanges();
    button.click();
    await fixture.whenStable();
    expect(api.run).toHaveBeenCalledTimes(1);
    expect(api.run).toHaveBeenCalledWith(patch);
    expect(fixture.nativeElement.textContent).toContain('Testy zaliczone');
    expect(fixture.componentInstance.confirmed()).toBe(false);
  });
  it('does not present a result for a replaced diff', async () => {
    let finish!: (result: any) => void;
    api.run.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    const fixture = TestBed.createComponent(AgentProjectTest);
    fixture.componentRef.setInput('preview',patch);
    await fixture.whenStable();
    fixture.componentInstance.confirmed.set(true);
    const promise = fixture.componentInstance.run();
    fixture.componentRef.setInput('preview',{...patch,proposed:'const x = 3;'});
    fixture.detectChanges();
    finish({status:'passed',scope:'frontend',message:'Stary wynik'});
    await promise;
    expect(fixture.componentInstance.visibleResult()).toBeNull();
  });
});
