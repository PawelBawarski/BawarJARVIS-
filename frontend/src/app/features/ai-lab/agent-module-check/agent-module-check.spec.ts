import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AgentModuleCheck } from './agent-module-check';
import { AgentModuleCheckApiService } from '../../../core/services/agent-module-check-api';
import { TranslationService } from '../../../core/services/translation';

const preview = { relativePath: 'counter.js', original: 'module.exports = 1;', proposed: 'module.exports = 2;', diff: '-1\n+2', notice: '' };
const result = { checkId: 'id', relativePath: 'counter.js', proposedSha256: 'a'.repeat(64),
  snapshotSha256: 'b'.repeat(64), kind: 'JS_TEST_MODULE', status: 'passed',
  summary: '1 test passed', fileCount: 2, output: 'PASS', elapsedMs: 50 };

describe('19.3 related-files module check', () => {
  const api = { run: vi.fn() };
  beforeEach(async () => {
    vi.resetAllMocks();
    api.run.mockResolvedValue(result);
    await TestBed.configureTestingModule({ imports: [AgentModuleCheck], providers: [
      { provide: AgentModuleCheckApiService, useValue: api },
      { provide: TranslationService, useValue: { translate: (key: string) => key, dictionaryVersion: () => 0 } },
    ] }).compileComponents();
  });

  it('never runs a test without a click, and rejects requests while disabled', async () => {
    const fixture = TestBed.createComponent(AgentModuleCheck);
    fixture.componentRef.setInput('preview', preview);
    fixture.componentRef.setInput('enabled', false);
    fixture.detectChanges(); await fixture.whenStable();
    await fixture.componentInstance.run();
    expect(api.run).not.toHaveBeenCalled();
    expect(fixture.componentInstance.currentResult()).toBeNull();
  });

  it('sends only the proposed code and explicitly selected related files', async () => {
    const fixture = TestBed.createComponent(AgentModuleCheck);
    fixture.componentRef.setInput('preview', preview);
    fixture.componentRef.setInput('enabled', true);
    fixture.detectChanges(); await fixture.whenStable();
    fixture.componentInstance.relatedFiles.set([{ name: 'counter.test.cjs', content: 'test("ok",()=>{})' }]);
    fixture.componentInstance.chosenTest.set('counter.test.cjs');
    await fixture.componentInstance.run();
    expect(api.run).toHaveBeenCalledWith(preview, [{ name: 'counter.test.cjs', content: 'test("ok",()=>{})' }], 'counter.test.cjs');
    expect(fixture.componentInstance.currentResult()?.status).toBe('passed');
  });

  it('ignores delayed check result if the proposal changes during Docker execution', async () => {
    let respond!: (value: typeof result) => void;
    api.run.mockReturnValue(new Promise<typeof result>(r => { respond = r; }));
    const fixture = TestBed.createComponent(AgentModuleCheck);
    fixture.componentRef.setInput('preview', preview);
    fixture.componentRef.setInput('enabled', true);
    fixture.detectChanges(); await fixture.whenStable();
    const running = fixture.componentInstance.run();
    fixture.componentRef.setInput('preview', { ...preview, proposed: 'module.exports = 3;' });
    fixture.detectChanges();
    respond(result);
    await running;
    expect(fixture.componentInstance.currentResult()).toBeNull();
  });

  it('invalidates a completed result when a related file changes', async () => {
    const fixture = TestBed.createComponent(AgentModuleCheck);
    fixture.componentRef.setInput('preview', preview);
    fixture.componentRef.setInput('enabled', true);
    fixture.detectChanges(); await fixture.whenStable();
    await fixture.componentInstance.run();
    expect(fixture.componentInstance.currentResult()).not.toBeNull();
    fixture.componentInstance.relatedFiles.set([{ name: 'new.test.js', content: 'test()' }]);
    expect(fixture.componentInstance.currentResult()).toBeNull();
  });
});
