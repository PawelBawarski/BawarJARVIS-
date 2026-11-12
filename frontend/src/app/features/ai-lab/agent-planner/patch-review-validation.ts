import { AgentCodeSource, AgentPatchPreview, AgentReviewSummary, AgentReviewWarning } from '../../../core/services/agent-proposal-api';

export const REVIEW_WARNINGS: readonly AgentReviewWarning[] = [
  'LARGE_CHANGE', 'PROCESS_EXECUTION', 'DYNAMIC_CODE', 'POSSIBLE_SECRET',
] as const;

/**
 * Verify that a model response is a non-empty, bounded preview of the SAME approved excerpt.
 * This is a transport/identity check, NOT a compiler, linter or security certification.
 */
export function checkedPatchPreview(value: unknown, source: AgentCodeSource): AgentPatchPreview {
  if (!value || typeof value !== 'object') throw new Error('Nieprawidłowa odpowiedź podglądu AI.');
  const response = value as Partial<AgentPatchPreview>;
  if (response.relativePath !== source.relativePath || response.original !== source.content) {
    throw new Error('Niezgodny lub nieaktualny podgląd. Wybierz plik ponownie.');
  }
  if (typeof response.proposed !== 'string' || !response.proposed.trim() ||
    response.proposed.length > 8000 || response.proposed.includes('\0') || response.proposed === source.content) {
    throw new Error('Model nie zwrócił poprawnej, zmienionej wersji kodu.');
  }
  if (typeof response.diff !== 'string' || !response.diff.trim() || response.diff.length > 25000 ||
    typeof response.notice !== 'string' || response.notice.length > 1000) {
    throw new Error('Odpowiedź AI nie zawiera poprawnego podglądu zmian.');
  }
  return response as AgentPatchPreview;
}

/** Counts lines in the changed middle region; unchanged prefix/suffix are excluded. */
export function summarizePatch(preview: AgentPatchPreview): AgentReviewSummary {
  const before = preview.original.split('\n');
  const after = preview.proposed.split('\n');
  let prefix = 0;
  while (prefix < before.length && prefix < after.length && before[prefix] === after[prefix]) prefix++;
  let suffix = 0;
  while (suffix < before.length - prefix && suffix < after.length - prefix &&
    before[before.length - 1 - suffix] === after[after.length - 1 - suffix]) suffix++;
  // Only known, bounded warning identifiers can influence the translated UI.
  const received = preview.review?.warnings;
  const warnings = Array.isArray(received)
    ? REVIEW_WARNINGS.filter(code => received.includes(code))
    : [];
  return {
    beforeLines: before.length,
    afterLines: after.length,
    removedLines: before.length - prefix - suffix,
    addedLines: after.length - prefix - suffix,
    warnings,
  };
}
