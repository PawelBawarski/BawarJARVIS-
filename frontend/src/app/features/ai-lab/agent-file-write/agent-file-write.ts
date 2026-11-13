import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { AgentPatchPreview } from '../../../core/services/agent-proposal-api';
import { AgentFileWriteApiService, FileWritePreparation, FileWriteDeployment, FileWriteStatus } from '../../../core/services/agent-file-write-api';
import { AgentIsolatedCheck } from '../agent-isolated-check/agent-isolated-check';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-agent-file-write', standalone: true,
  imports: [TranslatePipe, AgentIsolatedCheck],
  templateUrl: './agent-file-write.html', styleUrl: './agent-file-write.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AgentFileWrite implements OnInit {
  readonly preview = input.required<AgentPatchPreview>();
  private readonly api = inject(AgentFileWriteApiService);
  readonly config = signal<FileWriteStatus | null>(null);
  readonly busy = signal(false);
  readonly consent = signal(false);
  readonly rollbackConsent = signal(false);
  readonly prepared = signal<FileWritePreparation | null>(null);
  readonly preparedPreview = signal<AgentPatchPreview | null>(null);
  readonly history = signal<readonly FileWriteDeployment[]>([]);
  readonly message = signal('');
  readonly error = signal('');
  readonly errorKey = computed(() => {
    switch (this.error()) {
      case 'FILE_CHANGED': return 'lab.fileWrite.changed';
      case 'TICKET_EXPIRED': return 'lab.fileWrite.expired';
      case 'FILE_WRITES_DISABLED': return 'lab.fileWrite.disabled';
      default: return 'lab.fileWrite.error';
    }
  });
  readonly canApply = computed(() =>
    !this.busy() && this.consent() && !!this.prepared() &&
    this.preparedPreview()?.relativePath === this.preview().relativePath &&
    this.preparedPreview()?.original === this.preview().original &&
    this.preparedPreview()?.proposed === this.preview().proposed);

  ngOnInit(): void { void this.refresh(); }

  async refresh(): Promise<void> {
    try {
      const config = await this.api.status();
      this.config.set(config);
      if (config.enabled) this.history.set(await this.api.history());
    } catch { this.config.set({ enabled: false, scope: '', notice: 'BACKEND_UNAVAILABLE' }); }
  }

  async prepare(): Promise<void> {
    if (this.busy() || !this.config()?.enabled || !this.consent()) return;
    const current = this.preview();
    this.busy.set(true); this.error.set(''); this.message.set('');
    this.prepared.set(null); this.preparedPreview.set(null);
    try {
      const permit = await this.api.prepare(current);
      if (this.preview().relativePath !== current.relativePath ||
          this.preview().original !== current.original || this.preview().proposed !== current.proposed) {
        throw new Error('PREVIEW_CHANGED');
      }
      this.prepared.set(permit); this.preparedPreview.set(current);
    } catch (e) { this.error.set(e instanceof Error ? e.message : 'ERROR'); }
    finally { this.busy.set(false); }
  }

  async apply(): Promise<void> {
    const permit = this.prepared();
    if (!permit || !this.canApply()) return;
    this.busy.set(true); this.error.set(''); this.message.set('');
    // Never automatically retry a mutation after timeout. It may already be committed.
    this.prepared.set(null); this.preparedPreview.set(null); this.consent.set(false);
    try {
      const result = await this.api.apply(permit.ticket);
      this.message.set(result.message);
      await this.refresh();
    } catch (e) { this.error.set(e instanceof Error ? e.message : 'ACTION_UNCONFIRMED'); }
    finally { this.busy.set(false); }
  }

  async rollback(id: string): Promise<void> {
    if (this.busy() || !this.rollbackConsent()) return;
    this.busy.set(true); this.error.set(''); this.message.set('');
    this.rollbackConsent.set(false);
    try {
      const result = await this.api.rollback(id);
      this.message.set(result.message);
      await this.refresh();
    } catch (e) { this.error.set(e instanceof Error ? e.message : 'ACTION_UNCONFIRMED'); }
    finally { this.busy.set(false); }
  }
}
