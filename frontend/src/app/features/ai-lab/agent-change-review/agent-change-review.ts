import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { AgentPatchPreview, AgentReviewWarning } from '../../../core/services/agent-proposal-api';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { summarizePatch } from '../agent-planner/patch-review-validation';

/** Read-only review metadata. The button copies text only after explicit user interaction. */
@Component({
  selector: 'app-agent-change-review',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './agent-change-review.html',
  styleUrl: './agent-change-review.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AgentChangeReview {
  readonly preview = input<AgentPatchPreview | null>(null);
  readonly summary = computed(() => {
    const preview = this.preview();
    return preview ? summarizePatch(preview) : null;
  });
  readonly copyMessageKey = signal('');
  readonly copiedFor = signal<AgentPatchPreview | null>(null);

  warningKey(warning: AgentReviewWarning): string {
    return `lab.planner.review.warning.${warning}`;
  }

  async copyProposed(): Promise<void> {
    const patch = this.preview();
    if (!patch) return;
    this.copyMessageKey.set('');
    this.copiedFor.set(patch);
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable');
      await navigator.clipboard.writeText(patch.proposed);
      this.copyMessageKey.set('lab.planner.review.copySuccess');
    } catch {
      this.copyMessageKey.set('lab.planner.review.copyFailed');
    }
  }
}
