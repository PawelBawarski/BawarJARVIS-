import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ResearchSemanticApi, SemanticHit, SemanticStatus } from '../../../../core/services/research-semantic-api';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';

const errorCodes: Record<string, string> = {
  SEMANTIC_DISABLED: 'memory.semantic.disabled',
  SEMANTIC_QUERY_INVALID: 'memory.semantic.invalidQuery',
  SEMANTIC_MODEL_UNAVAILABLE: 'memory.semantic.offline',
};

@Component({
  selector: 'app-research-semantic-memory',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './semantic-memory.html',
  styleUrl: './semantic-memory.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SemanticMemory {
  private readonly api = inject(ResearchSemanticApi);
  readonly status = signal<SemanticStatus | null>(null);
  readonly query = signal('');
  readonly hits = signal<SemanticHit[]>([]);
  readonly busy = signal(false);
  readonly info = signal('');
  readonly error = signal('');
  readonly searched = signal(false);

  private async run(job: () => Promise<void>): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    this.info.set('');
    try { await job(); }
    catch (e) {
      const key = e instanceof Error ? e.message : '';
      this.error.set(errorCodes[key] ?? 'memory.semantic.requestError');
    } finally { this.busy.set(false); }
  }

  async refresh(): Promise<void> {
    await this.run(async () => { this.status.set(await this.api.status()); });
  }

  async indexNext(): Promise<void> {
    if (!this.status()?.configured || this.busy()) return;
    await this.run(async () => {
      const result = await this.api.indexNext();
      this.info.set(result.processed ? 'memory.semantic.indexDone' : 'memory.semantic.indexUpToDate');
      this.status.set(await this.api.status());
    });
  }

  async search(): Promise<void> {
    const query = this.query().trim();
    if (!query || query.length > 500 || this.busy()) return;
    await this.run(async () => {
      this.hits.set(await this.api.search(query));
      this.searched.set(true);
    });
  }
}
