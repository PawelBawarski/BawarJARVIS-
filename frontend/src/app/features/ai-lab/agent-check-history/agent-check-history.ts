import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { AgentProjectCheckHistoryApiService, ProjectCheckHistoryRun } from '../../../core/services/agent-project-check-history-api';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';

/** Explicitly loaded history; no background polling and no client-side fabricated PASS. */
@Component({
  selector: 'app-agent-check-history',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './agent-check-history.html',
  styleUrl: './agent-check-history.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AgentCheckHistory {
  private readonly api = inject(AgentProjectCheckHistoryApiService);
  readonly runs = signal<readonly ProjectCheckHistoryRun[]>([]);
  readonly busy = signal(false);
  readonly loaded = signal(false);
  readonly error = signal(false);
  readonly firstId = signal('');
  readonly secondId = signal('');
  readonly first = computed(() => this.runs().find(run => run.checkId === this.firstId()) ?? null);
  readonly second = computed(() => this.runs().find(run => run.checkId === this.secondId()) ?? null);
  readonly comparable = computed(() => Boolean(this.first() && this.second() &&
    this.first()?.relativePath === this.second()?.relativePath && this.first()?.kind === this.second()?.kind));
  readonly differentCode = computed(() => this.first()?.proposedSha256 !== this.second()?.proposedSha256);
  readonly elapsedDifference = computed(() => this.first() && this.second()
    ? this.second()!.elapsedMs - this.first()!.elapsedMs : null);

  async refresh(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set(false);
    try {
      const data = await this.api.list(20);
      this.runs.set(data);
      this.loaded.set(true);
      const ids = new Set(data.map(row => row.checkId));
      if (!ids.has(this.firstId())) this.firstId.set(data[0]?.checkId ?? '');
      if (!ids.has(this.secondId())) this.secondId.set(data[1]?.checkId ?? '');
    } catch {
      this.error.set(true);
    } finally {
      this.busy.set(false);
    }
  }
}
