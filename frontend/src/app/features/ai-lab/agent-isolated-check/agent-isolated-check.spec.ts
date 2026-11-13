import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AgentIsolatedCheck } from './agent-isolated-check';
import { AgentIsolatedCheckApiService } from '../../../core/services/agent-isolated-check-api';
import { TranslationService } from '../../../core/services/translation';

const preview = { relativePath: 'demo.ts', original: 'let a = 1;', proposed: 'let a = 2;', diff: '-old\n+new', notice: '' };
const result = { checkId: 'check', relativePath: 'demo.ts', proposedSha256: 'a'.repeat(64),
  kind: 'TS_SYNTAX', status: 'passed', summary: 'Parser passed', output: '', elapsedMs: 50 };

describe('19.2 Docker-only isolated checks', () => {
  const api = { status: vi.fn(), run: vi.fn() };
  beforeEach(async () => {
    vi.resetAllMocks();
    api.status.mockResolvedValue({ enabled: true, notice: 'Available' });
    api.run.mockResolvedValue(result);
    await TestBed.configureTestingModule({ imports: [AgentIsolatedCheck], providers: [
      { provide: AgentIsolatedCheckApiService, useValue: api },
      { provide: TranslationService, useValue: { translate: (key: string) => key, dictionaryVersion: () => 0 } },
    ] }).compileComponents();
  });

  it('does not start a check until explicit user action', async () => {
    const fixture = TestBed.createComponent(AgentIsolatedCheck);
    fixture.componentRef.setInput('preview', preview);
    fixture.detectChanges(); await fixture.whenStable();
    expect(api.run).not.toHaveBeenCalled();
    await fixture.componentInstance.run();
    expect(api.run).toHaveBeenCalledOnce();
    expect(fixture.componentInstance.currentResult()?.status).toBe('passed');
  });
  it('discards a late result after the preview is changed', async () => {
    let resolve!: (value: typeof result) => void;
    api.run.mockReturnValue(new Promise<typeof result>(r => { resolve = r; }));
    const fixture = TestBed.createComponent(AgentIsolatedCheck);
    fixture.componentRef.setInput('preview', preview);
    fixture.detectChanges(); await fixture.whenStable();
    const running = fixture.componentInstance.run();
    fixture.componentRef.setInput('preview', { ...preview, proposed: 'let a = 3;' });
    fixture.detectChanges();
    resolve(result);
    await running;
    expect(fixture.componentInstance.currentResult()).toBeNull();
  });
  it('does not run when disabled by the server', async () => {
    api.status.mockResolvedValue({ enabled: false, notice: 'Disabled' });
    const fixture = TestBed.createComponent(AgentIsolatedCheck);
    fixture.componentRef.setInput('preview', preview);
    fixture.detectChanges(); await fixture.whenStable();
    await fixture.componentInstance.run();
    expect(api.run).not.toHaveBeenCalled();
  });
});
