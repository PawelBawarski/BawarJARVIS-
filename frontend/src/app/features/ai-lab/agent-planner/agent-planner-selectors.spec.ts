import { describe, expect, it } from 'vitest';
import type { AgentCodeSource, AgentProposal } from '../../../core/services/agent-proposal-api';
import { countPendingReviews, countSourceCharacters, findDiffSource, proposalStatusKey } from './agent-planner-selectors';

describe('M04 - AgentPlanner pure selectors', () => {
  const sources: AgentCodeSource[] = [
    { relativePath: 'a.ts', content: 'ABC' },
    { relativePath: 'b.ts', content: '12' },
  ];

  it('selects the requested diff source or falls back to first', () => {
    expect(findDiffSource(sources, 'b.ts')).toBe(sources[1]);
    expect(findDiffSource(sources, 'missing.ts')).toBe(sources[0]);
    expect(findDiffSource([], '')).toBeNull();
  });

  it('counts source characters without altering the sources', () => {
    expect(countSourceCharacters(sources)).toBe(5);
    expect(sources).toHaveLength(2);
  });

  it('counts only pending proposals', () => {
    const proposals = [
      { status: 'PENDING' }, { status: 'APPROVED' }, { status: 'PENDING' },
    ] as unknown as AgentProposal[];
    expect(countPendingReviews(proposals)).toBe(2);
  });

  it('keeps the existing translation keys', () => {
    expect(proposalStatusKey('PENDING')).toBe('lab.planner.status.pending');
    expect(proposalStatusKey('APPROVED')).toBe('lab.planner.status.approved');
    expect(proposalStatusKey('REJECTED')).toBe('lab.planner.status.rejected');
  });
});
