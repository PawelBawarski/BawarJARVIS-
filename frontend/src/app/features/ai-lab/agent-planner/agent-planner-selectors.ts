import type { AgentCodeSource, AgentProposal } from '../../../core/services/agent-proposal-api';

/** Pure, separately testable selectors. No API calls or mutable state. */
export function findDiffSource(
  sources: readonly AgentCodeSource[], selectedPath: string,
): AgentCodeSource | null {
  return sources.find(source => source.relativePath === selectedPath) ?? sources[0] ?? null;
}

export function countSourceCharacters(sources: readonly AgentCodeSource[]): number {
  return sources.reduce((sum, source) => sum + source.content.length, 0);
}

export function countPendingReviews(proposals: readonly AgentProposal[]): number {
  return proposals.filter(proposal => proposal.status === 'PENDING').length;
}

export function proposalStatusKey(status: string): string {
  if (status === 'PENDING') return 'lab.planner.status.pending';
  if (status === 'APPROVED') return 'lab.planner.status.approved';
  return 'lab.planner.status.rejected';
}
