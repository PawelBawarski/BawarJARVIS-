import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { AgentPatchPreview } from '../../../core/services/agent-proposal-api';
import { AgentIsolatedCheckApiService, IsolatedCheckResult, IsolatedCheckStatus } from '../../../core/services/agent-isolated-check-api';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { AgentModuleCheck } from '../agent-module-check/agent-module-check';
import { AgentProjectCheck } from '../agent-project-check/agent-project-check';

@Component({
  selector: 'app-agent-isolated-check',
  standalone: true,
  imports: [TranslatePipe, AgentModuleCheck, AgentProjectCheck],
  templateUrl: './agent-isolated-check.html',
  styleUrl: './agent-isolated-check.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AgentIsolatedCheck implements OnInit {
  readonly preview = input.required<AgentPatchPreview>();
  private readonly api = inject(AgentIsolatedCheckApiService);
  readonly config = signal<IsolatedCheckStatus | null>(null);
  readonly busy = signal(false);
  readonly result = signal<IsolatedCheckResult | null>(null);
  readonly evaluated = signal<AgentPatchPreview | null>(null);
  readonly error = signal('');
  readonly currentResult = computed(() => {
    const evaluated = this.evaluated();
    const current = this.preview();
    return evaluated?.relativePath === current.relativePath &&
      evaluated?.original === current.original && evaluated?.proposed === current.proposed
      ? this.result() : null;
  });

  ngOnInit(): void { void this.refresh(); }
  async refresh(): Promise<void> {
    try { this.config.set(await this.api.status()); }
    catch { this.config.set({ enabled: false, notice: 'BACKEND_UNAVAILABLE' }); }
  }
  async run(): Promise<void> {
    if (this.busy() || !this.config()?.enabled) return;
    const snapshot = this.preview();
    this.busy.set(true);
    this.result.set(null);
    this.evaluated.set(null);
    this.error.set('');
    try {
      const result = await this.api.run(snapshot);
      // Prevent a delayed result from being presented for a new preview.
      const current = this.preview();
      if (snapshot.relativePath !== current.relativePath || snapshot.original !== current.original ||
          snapshot.proposed !== current.proposed) return;
      this.evaluated.set(snapshot);
      this.result.set(result);
    } catch (e) { this.error.set(e instanceof Error ? e.message : 'TEST_UNAVAILABLE'); }
    finally { this.busy.set(false); }
  }
}
