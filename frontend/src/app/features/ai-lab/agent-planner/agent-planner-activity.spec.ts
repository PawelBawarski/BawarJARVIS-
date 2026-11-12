import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AgentPlanner } from './agent-planner';
import { AgentProposal, AgentProposalApiService } from '../../../core/services/agent-proposal-api';
import { WorkspaceApiService } from '../../../core/services/workspace-api';
import { TranslationService } from '../../../core/services/translation';

const proposal: AgentProposal = {
  id: '8ef71522-27d0-4f9b-9bb3-d0245b9bf440',
  task: 'Dodaj test', plan: 'Plan testów', status: 'PENDING',
  createdAt: '2026-11-12T10:00:00Z', updatedAt: '2026-11-12T10:00:00Z',
};

describe('18.8: AgentPlanner explains its actual UI operation', () => {
  const api = {
    available: true, list: vi.fn(), generate: vi.fn(), approve: vi.fn(),
    reject: vi.fn(), revise: vi.fn(), previewPatch: vi.fn(),
  };
  const workspace = {
    available: false, status: vi.fn(), choose: vi.fn(), list: vi.fn(), read: vi.fn(),
  };

  beforeEach(async () => {
    vi.resetAllMocks();
    api.list.mockResolvedValue([]);
    api.generate.mockResolvedValue(proposal);
    api.approve.mockResolvedValue({ ...proposal, status: 'APPROVED' });
    await TestBed.configureTestingModule({
      imports: [AgentPlanner],
      providers: [
        { provide: AgentProposalApiService, useValue: api },
        { provide: WorkspaceApiService, useValue: workspace },
        { provide: TranslationService, useValue: { translate: (key: string) => key } },
      ],
    }).compileComponents();
  });

  it('shows a meaningful idle state, next action and one current step', async () => {
    const fixture = TestBed.createComponent(AgentPlanner);
    await fixture.whenStable();
    fixture.detectChanges();
    const planner = fixture.componentInstance;
    expect(planner.activityKey()).toBe('lab.planner.activity.ready');
    expect(planner.nextActionKey()).toBe('lab.planner.next.describe');
    const steps = fixture.nativeElement.querySelectorAll('[data-testid="agent-workflow-guide"] li[aria-current="step"]');
    expect(steps).toHaveLength(1);
    expect(steps[0].textContent).toContain('lab.planner.workflow1Title');
    expect(fixture.nativeElement.querySelector('[data-testid="agent-activity-message"]').getAttribute('aria-live'))
      .toBe('polite');
  });

  it('announces generation, waits for the response and then requires review', async () => {
    let finish!: (value: AgentProposal) => void;
    api.generate.mockImplementation(() => new Promise<AgentProposal>(resolve => { finish = resolve; }));
    const fixture = TestBed.createComponent(AgentPlanner);
    await fixture.whenStable();
    const planner = fixture.componentInstance;
    planner.task.set('Dodaj test');
    const request = planner.generate();
    fixture.detectChanges();
    expect(planner.activityBusy()).toBe(true);
    expect(planner.activityKey()).toBe('lab.planner.activity.generating');
    expect(planner.nextActionKey()).toBe('lab.planner.next.wait');
    expect(fixture.nativeElement.querySelector('[data-testid="agent-activity"]').getAttribute('data-busy'))
      .toBe('true');
    expect(api.approve).not.toHaveBeenCalled();
    finish(proposal);
    await request;
    fixture.detectChanges();
    expect(planner.activityBusy()).toBe(false);
    expect(planner.activityKey()).toBe('lab.planner.activity.review');
    expect(planner.nextActionKey()).toBe('lab.planner.next.review');
    expect(fixture.nativeElement.querySelectorAll('[data-testid="agent-workflow-guide"] li[aria-current="step"]'))
      .toHaveLength(1);
    await planner.approve();
    expect(planner.activityKey()).toBe('lab.planner.activity.approved');
    expect(planner.statusKey('APPROVED')).toBe('lab.planner.status.approved');
    expect(planner.info()).toContain('Nie wykonano żadnych zmian plików');
  });

  it('keeps a failed task editable and presents a retry instruction', async () => {
    api.generate.mockRejectedValue(new Error('LLM_NOT_READY'));
    const fixture = TestBed.createComponent(AgentPlanner);
    await fixture.whenStable();
    const planner = fixture.componentInstance;
    planner.task.set('Dodaj test');
    await planner.generate();
    expect(planner.task()).toBe('Dodaj test');
    expect(planner.activityKey()).toBe('lab.planner.activity.error');
    expect(planner.nextActionKey()).toBe('lab.planner.next.retry');
    expect(api.approve).not.toHaveBeenCalled();
  });

  it('never claims a selected local snippet was already sent to Qwen', async () => {
    const fixture = TestBed.createComponent(AgentPlanner);
    await fixture.whenStable();
    const planner = fixture.componentInstance;
    planner.manualPath.set('frontend/src/app/example.ts');
    planner.manualCode.set('export const x = 1;');
    planner.attachManualSource();
    expect(planner.activityKey()).toBe('lab.planner.activity.context');
    expect(api.generate).not.toHaveBeenCalled();
  });
});
