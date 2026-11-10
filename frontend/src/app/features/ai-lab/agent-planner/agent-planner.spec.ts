import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AgentPlanner } from './agent-planner';
import { AgentProposal, AgentProposalApiService } from '../../../core/services/agent-proposal-api';
import { WorkspaceApiService } from '../../../core/services/workspace-api';

const sample: AgentProposal = {
  id: '8ef71522-27d0-4f9b-9bb3-d0245b9bf440', task: 'Dodaj eksport PDF',
  plan: 'Najpierw testy, potem implementacja', status: 'PENDING',
  createdAt: '2026-11-10T10:00:00Z', updatedAt: '2026-11-10T10:00:00Z',
};

describe('AgentPlanner — proposals require explicit review', () => {
  const api = {
    available: true, list: vi.fn(), generate: vi.fn(), approve: vi.fn(), reject: vi.fn(), revise: vi.fn(),
  };
  const workspace = {
    available: true, status: vi.fn(), choose: vi.fn(), list: vi.fn(), read: vi.fn(),
  };
  beforeEach(async () => {
    vi.resetAllMocks();
    api.list.mockResolvedValue([]);
    api.generate.mockResolvedValue(sample);
    api.approve.mockResolvedValue({ ...sample, status: 'APPROVED' });
    api.reject.mockResolvedValue({ ...sample, status: 'REJECTED' });
    api.revise.mockResolvedValue({ ...sample, plan: 'Poprawiony plan' });
    workspace.status.mockResolvedValue({ selected: 'C:/DemoProject', readOnly: true, writeEnabled: false });
    workspace.choose.mockResolvedValue({ selected: 'C:/DemoProject', readOnly: true, writeEnabled: false });
    workspace.list.mockResolvedValue({ relativePath: '', entries: [
      { name: 'README.md', kind: 'file', relativePath: 'README.md' },
    ] });
    workspace.read.mockResolvedValue({ relativePath: 'README.md', content: 'JARVIS demo project', size: 19 });
    await TestBed.configureTestingModule({
      imports: [AgentPlanner], providers: [
        { provide: AgentProposalApiService, useValue: api },
        { provide: WorkspaceApiService, useValue: workspace },
      ],
    }).compileComponents();
  });

  it('creates plan and does not approve without user interaction', async () => {
    const fixture = TestBed.createComponent(AgentPlanner);
    await fixture.whenStable();
    fixture.componentInstance.task.set('Dodaj eksport PDF');
    await fixture.componentInstance.generate();
    fixture.detectChanges();
    expect(api.generate).toHaveBeenCalledWith('Dodaj eksport PDF');
    expect(fixture.nativeElement.querySelector('[data-testid="agent-plan"]').textContent)
      .toContain('Najpierw testy');
    expect(api.approve).not.toHaveBeenCalled();
    expect(fixture.componentInstance.task()).toBe('');
  });

  it('only explicit approval changes the plan status', async () => {
    api.list.mockResolvedValue([sample]);
    const fixture = TestBed.createComponent(AgentPlanner);
    await fixture.whenStable();
    await fixture.componentInstance.approve();
    expect(api.approve).toHaveBeenCalledWith(sample.id);
    expect(fixture.componentInstance.selected()?.status).toBe('APPROVED');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="agent-approve"]')).toBeNull();
  });

  it('model errors preserve user task', async () => {
    api.generate.mockRejectedValue(new Error('LLM_UNAVAILABLE'));
    const fixture = TestBed.createComponent(AgentPlanner);
    await fixture.whenStable();
    fixture.componentInstance.task.set('Dodaj eksport PDF');
    await fixture.componentInstance.generate();
    expect(fixture.componentInstance.error()).toContain('LLM_UNAVAILABLE');
    expect(fixture.componentInstance.task()).toBe('Dodaj eksport PDF');
    expect(api.approve).not.toHaveBeenCalled();
  });

  it('never reads local code until user opens a file and attaches it', async () => {
    const fixture = TestBed.createComponent(AgentPlanner);
    await fixture.whenStable();
    const planner = fixture.componentInstance;
    expect(workspace.read).not.toHaveBeenCalled();
    await planner.chooseWorkspace();
    expect(workspace.read).not.toHaveBeenCalled();
    await planner.openWorkspaceEntry({ name: 'README.md', kind: 'file', relativePath: 'README.md' });
    expect(workspace.read).toHaveBeenCalledWith('README.md');
    expect(planner.sources()).toHaveLength(0);
    planner.attachPreview();
    expect(planner.sources()).toEqual([{ relativePath: 'README.md', content: 'JARVIS demo project' }]);
    planner.task.set('Zaplanuj ulepszenie');
    await planner.generate();
    expect(api.generate).toHaveBeenCalledWith('Zaplanuj ulepszenie', [
      { relativePath: 'README.md', content: 'JARVIS demo project' },
    ]);
    expect(api.approve).not.toHaveBeenCalled();
  });

  it('excludes manually removed files from plans', async () => {
    const fixture = TestBed.createComponent(AgentPlanner);
    await fixture.whenStable();
    await fixture.componentInstance.chooseWorkspace();
    await fixture.componentInstance.openWorkspaceEntry({ name: 'README.md', kind: 'file', relativePath: 'README.md' });
    fixture.componentInstance.attachPreview();
    fixture.componentInstance.removeSource('README.md');
    fixture.componentInstance.task.set('Zaplanuj ulepszenie');
    await fixture.componentInstance.generate();
    expect(api.generate).toHaveBeenCalledWith('Zaplanuj ulepszenie');
  });

});
