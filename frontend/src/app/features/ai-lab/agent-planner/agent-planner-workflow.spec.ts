import { describe, expect, it } from 'vitest';
import { focusWorkflowTarget } from './agent-planner-workflow';

describe('AI Lab workflow navigation (M08)', () => {
  it('opens and focuses the source context panel', () => {
    const details = document.createElement('details');
    details.tabIndex = -1;
    document.body.append(details);
    try {
      expect(focusWorkflowTarget(details, true)).toBe(true);
      expect(details.open).toBe(true);
      expect(document.activeElement).toBe(details);
    } finally { details.remove(); }
  });

  it('focuses the task editor without submitting any action', () => {
    const textarea = document.createElement('textarea');
    document.body.append(textarea);
    try {
      expect(focusWorkflowTarget(textarea)).toBe(true);
      expect(document.activeElement).toBe(textarea);
    } finally { textarea.remove(); }
  });

  it('focuses the review panel', () => {
    const review = document.createElement('article');
    review.tabIndex = -1;
    document.body.append(review);
    try {
      expect(focusWorkflowTarget(review)).toBe(true);
      expect(document.activeElement).toBe(review);
    } finally { review.remove(); }
  });

  it('returns false for absent conditional content', () => {
    expect(focusWorkflowTarget(null)).toBe(false);
  });
});
