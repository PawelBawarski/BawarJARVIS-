import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AgentChangeReview } from './agent-change-review';
import { TranslationService } from '../../../core/services/translation';
import { AgentPatchPreview } from '../../../core/services/agent-proposal-api';

const preview: AgentPatchPreview = {
  relativePath: 'frontend/demo.ts', original: 'let x = 1;', proposed: 'let x = 2;',
  diff: '-let x = 1;\n+let x = 2;', notice: 'Nothing saved',
  review: { beforeLines: 1, afterLines: 1, addedLines: 1, removedLines: 1, warnings: ['DYNAMIC_CODE'] },
};

describe('AgentChangeReview — 19.0', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [AgentChangeReview], providers: [
      { provide: TranslationService, useValue: { translate: (key: string) => key } },
    ] }).compileComponents();
  });

  it('does not render a review before a preview exists', () => {
    const fixture = TestBed.createComponent(AgentChangeReview);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="agent-change-review"]')).toBeNull();
  });

  it('shows risk hints and states explicitly that tests were not run', () => {
    const fixture = TestBed.createComponent(AgentChangeReview);
    fixture.componentRef.setInput('preview', preview);
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('lab.planner.review.warning.DYNAMIC_CODE');
    expect(text).toContain('lab.planner.review.notVerified');
    expect(fixture.nativeElement.querySelector('[data-testid="agent-review-metrics"]')).not.toBeNull();
  });

  it('copies code only upon explicit invocation, never applying any patch', async () => {
    const fixture = TestBed.createComponent(AgentChangeReview);
    fixture.componentRef.setInput('preview', preview);
    fixture.detectChanges();
    const clipboardWrite = vi.fn().mockResolvedValue(undefined);
    const original = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: clipboardWrite } });
    try {
      expect(clipboardWrite).not.toHaveBeenCalled();
      await fixture.componentInstance.copyProposed();
      expect(clipboardWrite).toHaveBeenCalledTimes(1);
      expect(clipboardWrite).toHaveBeenCalledWith('let x = 2;');
      expect(fixture.componentInstance.copyMessageKey()).toBe('lab.planner.review.copySuccess');
    } finally {
      if (original) Object.defineProperty(navigator, 'clipboard', original);
      else delete (navigator as unknown as Record<string, unknown>)['clipboard'];
    }
  });
});
