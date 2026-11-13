import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AgentProjectCheck, permittedProjectPath, previewProjectPath } from './agent-project-check';
import { AgentProjectCheckApiService } from '../../../core/services/agent-project-check-api';
import { TranslationService } from '../../../core/services/translation';

const preview = { relativePath: 'frontend/src/app/demo.ts', original: 'export const n = 1;',
  proposed: 'export const n = 2;', diff: '-1\n+2', notice: '' };
const sources = [
  { path: 'package.json', content: '{}' }, { path: 'package-lock.json', content: '{}' },
  { path: 'angular.json', content: '{}' }, { path: 'tsconfig.json', content: '{}' },
  { path: 'src/app/demo.ts', content: preview.original },
];
const result = { checkId: 'id', kind: 'angular', status: 'passed', relativePath: 'src/app/demo.ts',
  summary: 'Angular passed', proposedSha256: 'a'.repeat(64), snapshotSha256: 'b'.repeat(64),
  image: 'jarvis-angular-test:19-4-123456789abc', fileCount: 5, output: 'all passed', elapsedMs: 100 };

describe('19.4 offline project test', () => {
  const api = { run: vi.fn() };
  beforeEach(async () => {
    vi.resetAllMocks();
    api.run.mockResolvedValue(result);
    await TestBed.configureTestingModule({ imports: [AgentProjectCheck], providers: [
      { provide: AgentProjectCheckApiService, useValue: api },
      { provide: TranslationService, useValue: { translate: (key: string) => key, dictionaryVersion: () => 0 } },
    ] }).compileComponents();
  });
  it('filters unsafe upload paths and maps repository-relative path', () => {
    expect(permittedProjectPath('src/app/demo.ts', 'angular')).toBe(true);
    expect(permittedProjectPath('src/../.env', 'angular')).toBe(false);
    expect(permittedProjectPath('node_modules/lib/index.js', 'angular')).toBe(false);
    expect(permittedProjectPath('.env.jarvis', 'spring')).toBe(false);
    expect(previewProjectPath(preview.relativePath, 'angular')).toBe('src/app/demo.ts');
  });
  it('never calls server until user clicks and only with matching original', async () => {
    const fixture = TestBed.createComponent(AgentProjectCheck);
    fixture.componentRef.setInput('preview', preview);
    fixture.componentRef.setInput('enabled', true);
    fixture.detectChanges(); await fixture.whenStable();
    expect(api.run).not.toHaveBeenCalled();
    fixture.componentInstance.files.set(sources);
    expect(fixture.componentInstance.validSnapshot()).toBe(true);
    await fixture.componentInstance.run();
    expect(api.run).toHaveBeenCalledWith('angular', preview, sources);
    expect(fixture.componentInstance.currentResult()?.status).toBe('passed');
  });
  it('rejects disabled runner and mismatched content', async () => {
    const fixture = TestBed.createComponent(AgentProjectCheck);
    fixture.componentRef.setInput('preview', preview);
    fixture.componentRef.setInput('enabled', false);
    fixture.detectChanges(); await fixture.whenStable();
    fixture.componentInstance.files.set(sources);
    await fixture.componentInstance.run();
    expect(api.run).not.toHaveBeenCalled();
    fixture.componentInstance.files.set([...sources.slice(0, 4), { path: 'src/app/demo.ts', content: 'changed' }]);
    expect(fixture.componentInstance.validSnapshot()).toBe(false);
  });
  it('ignores late test result after proposal change', async () => {
    let respond!: (value: typeof result) => void;
    api.run.mockReturnValue(new Promise<typeof result>(resolve => { respond = resolve; }));
    const fixture = TestBed.createComponent(AgentProjectCheck);
    fixture.componentRef.setInput('preview', preview);
    fixture.componentRef.setInput('enabled', true);
    fixture.detectChanges(); await fixture.whenStable();
    fixture.componentInstance.files.set(sources);
    const pending = fixture.componentInstance.run();
    fixture.componentRef.setInput('preview', { ...preview, proposed: 'export const n = 3;' });
    fixture.detectChanges();
    respond(result);
    await pending;
    expect(fixture.componentInstance.currentResult()).toBeNull();
  });
});
