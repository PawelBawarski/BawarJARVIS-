import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { AgentPatchPreview } from '../../../core/services/agent-proposal-api';
import { ProjectTestReport } from '../../../core/services/agent-project-test-api';
import { AgentWorkspaceApplyApiService, DeploymentHistory } from '../../../core/services/agent-workspace-apply-api';

@Component({
  selector: 'app-agent-workspace-apply', standalone: true, imports: [],
  templateUrl: './agent-workspace-apply.html', styleUrl: './agent-workspace-apply.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AgentWorkspaceApply implements OnInit {
  readonly preview = input.required<AgentPatchPreview>();
  readonly report = input<ProjectTestReport | null>(null);
  readonly api = inject(AgentWorkspaceApplyApiService);
  readonly confirmed = signal(false);
  readonly busy = signal(false);
  readonly message = signal('');
  readonly error = signal('');
  readonly deployment = signal<{relativePath: string; id: string} | null>(null);
  readonly history = signal<readonly DeploymentHistory[]>([]);
  ngOnInit(): void { if (this.api.available) void this.refreshHistory(); }
  async refreshHistory(): Promise<void> {
    try { this.history.set((await this.api.history()).deployments); } catch { this.history.set([]); }
  }
  readonly grant = computed(() => this.report()?.status === 'passed' ? this.report()?.grantId ?? null : null);
  readonly canApply = computed(() => !this.busy() && !this.deployment() && !!this.grant() && this.api.available && this.confirmed());

  async apply(): Promise<void> {
    const grantId = this.grant();
    if (!this.canApply() || !grantId) return;
    const requested = this.preview();
    this.busy.set(true);
    this.message.set('');
    this.error.set('');
    try {
      const result = await this.api.apply(grantId);
      this.confirmed.set(false);
      if (result.status === 'applied' && result.deploymentId && result.relativePath === requested.relativePath) {
        this.deployment.set({relativePath:result.relativePath, id:result.deploymentId});
      }
      this.message.set(result.message);
      if (result.status === 'applied') await this.refreshHistory();
    } catch (reason) {
      this.error.set(reason instanceof Error ? reason.message : 'Nie udało się zapisać zmiany.');
    } finally {this.busy.set(false);}
  }

  async rollback(): Promise<void> {
    const deployed = this.deployment();
    if (!deployed) return;
    return this.rollbackId(deployed.id);
  }

  async rollbackId(id: string): Promise<void> {
    if (!this.api.available || this.busy()) return;
    this.busy.set(true);
    this.message.set('');
    this.error.set('');
    try {
      const result = await this.api.rollback(id);
      if (result.status === 'rolled_back') {
        if (this.deployment()?.id === id) this.deployment.set(null);
        await this.refreshHistory();
      }
      this.message.set(result.message);
    } catch (reason) {
      this.error.set(reason instanceof Error ? reason.message : 'Nie udało się cofnąć zmiany.');
    } finally {this.busy.set(false);}
  }
}
