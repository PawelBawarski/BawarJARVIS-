import { describe, expect, it } from 'vitest';
import { checkedPatchPreview, summarizePatch } from './patch-review-validation';
import { AgentPatchPreview } from '../../../core/services/agent-proposal-api';

const source = { relativePath: 'frontend/src/app/demo.ts', content: 'const x = 1;\nconst y = 2;' };
const preview: AgentPatchPreview = {
  relativePath: source.relativePath, original: source.content,
  proposed: 'const x = 1;\nconst y = 3;',
  diff: '--- a/demo.ts\n+++ b/demo.ts\n-const y = 2;\n+const y = 3;',
  notice: 'Read-only preview',
};

describe('Stage 19.0 — read-only code review boundary', () => {
  it('accepts an unchanged approved source and a bounded replacement', () => {
    expect(checkedPatchPreview(preview, source)).toBe(preview);
    expect(summarizePatch(preview)).toEqual({
      beforeLines: 2, afterLines: 2, removedLines: 1, addedLines: 1, warnings: [],
    });
  });

  it('rejects a mismatched source, even if the path matches', () => {
    expect(() => checkedPatchPreview({ ...preview, original: 'another file' }, source))
      .toThrow('Niezgodny');
    expect(() => checkedPatchPreview({ ...preview, relativePath: 'other.ts' }, source))
      .toThrow('Niezgodny');
  });

  it('rejects empty, identical, oversized, NUL and malformed proposals', () => {
    for (const proposed of ['', '   ', source.content, 'a'.repeat(8001), 'x\0y']) {
      expect(() => checkedPatchPreview({ ...preview, proposed }, source)).toThrow();
    }
    expect(() => checkedPatchPreview(null, source)).toThrow();
    expect(() => checkedPatchPreview({ ...preview, diff: '' }, source)).toThrow();
    expect(() => checkedPatchPreview({ ...preview, notice: 123 }, source)).toThrow();
  });

  it('ignores unknown warning identifiers instead of rendering model-provided text', () => {
    const input = {
      ...preview,
      review: { beforeLines: 99, afterLines: 99, removedLines: 99, addedLines: 99,
        warnings: ['POSSIBLE_SECRET', 'UNKNOWN', 'DYNAMIC_CODE', 'POSSIBLE_SECRET'] as any },
    };
    expect(summarizePatch(input)).toEqual({
      beforeLines: 2, afterLines: 2, removedLines: 1, addedLines: 1,
      warnings: ['DYNAMIC_CODE', 'POSSIBLE_SECRET'],
    });
  });

  it('counts a new block with unchanged leading and trailing lines', () => {
    const input = { ...preview, original: 'first\nold\nlast', proposed: 'first\nnew A\nnew B\nlast' };
    expect(summarizePatch(input)).toMatchObject({ beforeLines: 3, afterLines: 4, removedLines: 1, addedLines: 2 });
  });
});
