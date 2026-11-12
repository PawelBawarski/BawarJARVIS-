import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AgentPlanner } from './agent-planner';
import { AgentProposalApiService } from '../../../core/services/agent-proposal-api';
import { WorkspaceApiService } from '../../../core/services/workspace-api';

const source = { relativePath: 'frontend/src/app/example.ts', content: 'export const x = 1;' };
const patch = {
  relativePath: source.relativePath, original: source.content,
  proposed: 'export const x = 2;', diff: '--- a/example.ts\n+++ b/example.ts\n-export const x = 1;\n+export const x = 2;',
  notice: 'Nie zapisano zmian.',
};

describe('AgentPlanner 16.3: preview diff never applies changes', () => {
  const api = { available: true, list: vi.fn(), generate: vi.fn(), approve: vi.fn(), reject: vi.fn(), revise: vi.fn(), previewPatch: vi.fn() };
  const workspace = { available: true, status: vi.fn(), choose: vi.fn(), list: vi.fn(), read: vi.fn() };
  beforeEach(async () => {
    vi.resetAllMocks();
    api.list.mockResolvedValue([]);
    api.previewPatch.mockResolvedValue(patch);
    workspace.choose.mockResolvedValue({ selected: 'C:/DemoProject', readOnly: true, writeEnabled: false });
    workspace.list.mockResolvedValue({ relativePath: '', entries: [] });
    workspace.read.mockResolvedValue({ ...source, size: source.content.length });
    await TestBed.configureTestingModule({ imports: [AgentPlanner], providers: [
      { provide: AgentProposalApiService, useValue: api },
      { provide: WorkspaceApiService, useValue: workspace },
    ] }).compileComponents();
  });

  async function prepared() {
    const fixture = TestBed.createComponent(AgentPlanner);
    await fixture.whenStable();
    const planner = fixture.componentInstance;
    await planner.chooseWorkspace();
    await planner.openWorkspaceEntry({ kind: 'file', name: 'example.ts', relativePath: source.relativePath });
    planner.attachPreview();
    planner.task.set('Zmień stałą x na 2');
    fixture.detectChanges();
    return { fixture, planner };
  }

  it('renders diff and does not issue any write operation', async () => {
    const { fixture, planner } = await prepared();
    await planner.generateDiff();
    fixture.detectChanges();
    expect(api.previewPatch).toHaveBeenCalledWith('Zmień stałą x na 2', source);
    const view = fixture.nativeElement as HTMLElement;
    expect(view.querySelector('[data-testid="agent-diff-text"]')?.textContent).toContain('+export const x = 2;');
    expect(view.querySelector('[data-testid="agent-diff-original"]')?.textContent).toContain('export const x = 1;');
    expect(workspace.read).toHaveBeenCalledTimes(1);
    expect(api.approve).not.toHaveBeenCalled();
    expect(api.generate).not.toHaveBeenCalled();
  });

  it('discarded source invalidates existing preview', async () => {
    const { planner } = await prepared();
    await planner.generateDiff();
    expect(planner.diffPreview()).not.toBeNull();
    planner.removeSource(source.relativePath);
    expect(planner.diffPreview()).toBeNull();
  });

  it('rejects response for another file without displaying it', async () => {
    api.previewPatch.mockResolvedValue({ ...patch, relativePath: 'frontend/src/app/other.ts' });
    const { planner } = await prepared();
    await planner.generateDiff();
    expect(planner.diffPreview()).toBeNull();
    expect(planner.diffError()).toContain('Niezgodny');
  });

  it('shows backend failure while preserving the selected source and task', async () => {
    api.previewPatch.mockRejectedValue(new Error('QWEN_OFFLINE'));
    const { planner } = await prepared();
    await planner.generateDiff();
    expect(planner.diffError()).toContain('QWEN_OFFLINE');
    expect(planner.sources()).toEqual([source]);
    expect(planner.task()).toBe('Zmień stałą x na 2');
  });

  it('does not show a stale preview when the task changes while Qwen is generating', async () => {
    let resolvePreview!: (value: typeof patch) => void;
    api.previewPatch.mockReturnValue(new Promise(resolve => { resolvePreview = resolve; }));
    const { planner } = await prepared();
    const pending = planner.generateDiff();
    planner.updateTask('Nowa treść zadania');
    resolvePreview(patch);
    await pending;
    expect(planner.diffPreview()).toBeNull();
    expect(planner.diffError()).toContain('nieaktualny');
  });

  it('rejects model output identical to the submitted source', async () => {
    api.previewPatch.mockResolvedValue({ ...patch, proposed: source.content });
    const { planner } = await prepared();
    await planner.generateDiff();
    expect(planner.diffPreview()).toBeNull();
    expect(planner.diffError()).toContain('zmienionej wersji');
  });
});
