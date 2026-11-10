import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { AgentPatchPreview } from '../../../core/services/agent-proposal-api';
import { AgentProjectTestApiService, ProjectTestReport } from '../../../core/services/agent-project-test-api';
import { AgentWorkspaceApply } from '../agent-workspace-apply/agent-workspace-apply'; // JARVIS_16_6_NATIVE_APPLY

@Component({
  selector: 'app-agent-project-test', standalone: true,
  imports: [AgentWorkspaceApply], templateUrl: './agent-project-test.html', styleUrl: './agent-project-test.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AgentProjectTest {
  readonly preview = input.required<AgentPatchPreview>();
  readonly api = inject(AgentProjectTestApiService);
  readonly supported = computed(() =>
    /^(?:frontend\/src\/.*\.(?:ts|tsx|js|html|scss|css|json)|backend\/src\/.*\.java)$/i.test(this.preview().relativePath));
  readonly confirmed = signal(false);
  readonly busy = signal(false);
  readonly result = signal<{ patch: AgentPatchPreview; report: ProjectTestReport } | null>(null);
  readonly error = signal('');
  readonly visibleResult = computed(() => {
    const current = this.result();
    return current?.patch === this.preview() ? current.report : null;
  });

  async run(): Promise<void> {
    if (this.busy() || !this.confirmed() || !this.supported() || !this.api.available) return;
    const patch = this.preview();
    this.busy.set(true);
    this.error.set('');
    this.result.set(null);
    try {
      const report = await this.api.run(patch);
      if (this.preview() === patch) this.result.set({patch, report});
    } catch (reason) {
      if (this.preview() === patch) this.error.set(reason instanceof Error ? reason.message : 'Błąd testowania projektu.');
    } finally {
      this.busy.set(false);
      this.confirmed.set(false);
    }
  }
}
