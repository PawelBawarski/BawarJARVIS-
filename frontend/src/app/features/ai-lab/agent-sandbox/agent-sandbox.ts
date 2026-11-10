import { ChangeDetectionStrategy, Component, input, inject, computed, signal } from '@angular/core';
import { AgentPatchPreview } from '../../../core/services/agent-proposal-api';
import { AgentSandboxApiService, SandboxReport } from '../../../core/services/agent-sandbox-api';
import { AgentProjectTest } from '../agent-project-test/agent-project-test'; // JARVIS_STAGE16_5_PROJECT_TEST

@Component({
  selector: 'app-agent-sandbox', standalone: true, imports: [AgentProjectTest],
  templateUrl: './agent-sandbox.html', styleUrl: './agent-sandbox.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AgentSandbox {
  readonly preview = input.required<AgentPatchPreview>();
  readonly sandbox = inject(AgentSandboxApiService);
  readonly supported = computed(() => /\.(?:ts|tsx|js|cjs|json|java)$/i.test(this.preview().relativePath));
  readonly busy = signal(false);
  readonly result = signal<SandboxReport | null>(null);
  readonly error = signal('');

  async check(): Promise<void> {
    if (this.busy() || !this.sandbox.available || !this.supported()) return;
    const selected = this.preview();
    this.busy.set(true);
    this.result.set(null);
    this.error.set('');
    try {
      const result = await this.sandbox.check(selected);
      if (this.preview() === selected) this.result.set(result);
    } catch (reason) {
      if (this.preview() === selected) this.error.set(reason instanceof Error ? reason.message : 'Błąd weryfikacji.');
    } finally { this.busy.set(false); }
  }
}
