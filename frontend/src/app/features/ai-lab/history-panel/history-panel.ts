import { Component, inject, OnInit, signal } from '@angular/core';
import { SlicePipe } from '@angular/common';
import {
  AiLabApiService, LabCheckpointRecord, LabEvaluationRecord,
  LabEpochRecord, LabTrainingRunRecord,
} from '../../../core/services/ai-lab-api';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-ai-lab-history',
  imports: [TranslatePipe, SlicePipe],
  templateUrl: './history-panel.html',
  styleUrl: './history-panel.scss',
})
export class AiLabHistoryPanel implements OnInit {
  private readonly api = inject(AiLabApiService);
  readonly runs = signal<LabTrainingRunRecord[]>([]);
  readonly epochs = signal<LabEpochRecord[]>([]);
  readonly checkpoints = signal<LabCheckpointRecord[]>([]);
  readonly evaluations = signal<LabEvaluationRecord[]>([]);
  readonly selectedRun = signal<string | null>(null);
  readonly first = signal('');
  readonly second = signal('');
  readonly evalText = signal('ala\nala ma kota');
  readonly busy = signal(false);
  readonly error = signal('');
  readonly info = signal('');

  ngOnInit(): void { void this.refresh(); }

  async refresh(): Promise<void> {
    if (!this.api.available) { this.error.set('DESKTOP_BRIDGE_UNAVAILABLE'); return; }
    if (this.busy()) return;
    this.busy.set(true);
    try {
      const [runs, checkpoints, evaluations] = await Promise.all([
        this.api.historyRuns(), this.api.historyCheckpoints(), this.api.historyEvaluations(),
      ]);
      this.runs.set(runs);
      this.checkpoints.set(checkpoints);
      this.evaluations.set(evaluations);
      if (this.selectedRun() && !runs.some(r => r.id === this.selectedRun())) this.selectedRun.set(null);
      if (!this.selectedRun() && runs.length) this.selectedRun.set(runs[0].id);
      this.epochs.set(this.selectedRun() ? await this.api.historyEpochs(this.selectedRun()!) : []);
      if (!checkpoints.some(c => c.id === this.first())) this.first.set(checkpoints[0]?.id ?? '');
      if (!checkpoints.some(c => c.id === this.second())) this.second.set(checkpoints[1]?.id ?? '');
      this.error.set('');
    } catch (error) { this.error.set(this.errorLabel(error)); }
    finally { this.busy.set(false); }
  }

  async selectRun(id: string): Promise<void> {
    if (this.busy()) return;
    this.selectedRun.set(id);
    try {
      this.epochs.set(await this.api.historyEpochs(id));
      this.error.set('');
    } catch (error) { this.error.set(this.errorLabel(error)); }
  }

  onFirst(event: Event): void { this.first.set((event.target as HTMLSelectElement).value); }
  onSecond(event: Event): void { this.second.set((event.target as HTMLSelectElement).value); }
  onEvalText(event: Event): void { this.evalText.set((event.target as HTMLTextAreaElement).value); }
  checkpoint(id: string): LabCheckpointRecord | undefined {
    return this.checkpoints().find(record => record.id === id);
  }
  canCompareEvaluations(): boolean {
    const a = this.checkpoint(this.first());
    const b = this.checkpoint(this.second());
    return !!(a && b && a.id !== b.id && a.evaluationCorpusSha256 &&
      a.evaluationCorpusSha256 === b.evaluationCorpusSha256 &&
      a.evaluationPerplexity !== null && b.evaluationPerplexity !== null);
  }
  async evaluate(): Promise<void> {
    if (this.busy()) return;
    const examples = this.evalText().split(/\r?\n/).map(x => x.trim()).filter(Boolean);
    if (!examples.length || examples.length > 100 || examples.some(x => x.length > 256)) {
      this.error.set('INVALID_EVALUATION_INPUT'); return;
    }
    this.busy.set(true); this.error.set(''); this.info.set('');
    try {
      const result = await this.api.evaluate(examples);
      this.info.set(`Cross-Entropy: ${result.meanCrossEntropy.toFixed(6)} · Perplexity: ${result.perplexity.toFixed(6)}`);
      this.evaluations.set(await this.api.historyEvaluations());
      this.checkpoints.set(await this.api.historyCheckpoints());
    } catch (error) { this.error.set(this.errorLabel(error)); }
    finally { this.busy.set(false); }
  }
  private errorLabel(error: unknown): string {
    return error instanceof Error ? error.message : 'REQUEST_FAILED';
  }
}
