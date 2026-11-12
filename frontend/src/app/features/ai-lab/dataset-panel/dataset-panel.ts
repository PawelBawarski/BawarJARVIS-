import { ChangeDetectionStrategy, Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import {
  AiLabApiService, LabDatasetSummary, LabDatasetVersion, LabDatasetContent,
} from '../../../core/services/ai-lab-api';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { LabTrainingMonitor } from '../../../core/services/lab-training-monitor';

@Component({
  selector: 'app-ai-lab-dataset',
  imports: [TranslatePipe],
  templateUrl: './dataset-panel.html',
  styleUrl: './dataset-panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AiLabDatasetPanel implements OnInit, OnDestroy {
  private readonly api = inject(AiLabApiService);
  private readonly monitor = inject(LabTrainingMonitor);
  readonly datasets = signal<LabDatasetSummary[]>([]);
  readonly versions = signal<LabDatasetVersion[]>([]);
  readonly selectedDataset = signal('');
  readonly selectedVersion = signal('');
  readonly loaded = signal<LabDatasetContent | null>(null);
  readonly name = signal('');
  readonly draft = signal('ala\nala ma kota\nkot ma ale\nkot lubi mleko\nala lubi kota');
  readonly epochs = signal(3);
  readonly busy = signal(false);
  readonly message = signal('');
  readonly error = signal('');
  private readonly trainingStarted = signal(false);
  readonly job = computed(() => this.trainingStarted() ? this.monitor.state() : null);

  ngOnInit(): void {
    this.monitor.acquire();
    void this.refresh();
  }
  ngOnDestroy(): void { this.monitor.release(); }

  onName(event: Event): void { this.name.set((event.target as HTMLInputElement).value); }
  onDraft(event: Event): void { this.draft.set((event.target as HTMLTextAreaElement).value); }
  onEpochs(event: Event): void { this.epochs.set(Number((event.target as HTMLInputElement).value)); }

  private examples(): string[] {
    return this.draft().split(/\r?\n/).map(v => v.trim()).filter(Boolean);
  }
  private valid(): boolean {
    const entries = this.examples();
    return entries.length >= 5 && entries.length <= 100 &&
      entries.every(v => v.length <= 256 && !/[\x00-\x1f\x7f]/.test(v)) &&
      new Set(entries).size === entries.length;
  }
  private messageOf(error: unknown): string {
    return error instanceof Error ? error.message : 'REQUEST_FAILED';
  }
  async refresh(): Promise<void> {
    if (!this.api.available) { this.error.set('DESKTOP_BRIDGE_UNAVAILABLE'); return; }
    if (this.busy()) return;
    this.busy.set(true);
    try {
      this.datasets.set(await this.api.datasetList());
      this.error.set('');
    } catch (error) { this.error.set(this.messageOf(error)); }
    finally { this.busy.set(false); }
  }

  async create(): Promise<void> {
    if (this.busy()) return;
    if (!this.name().trim() || this.name().trim().length > 80 || !this.valid()) {
      this.error.set('INVALID_DATASET_INPUT'); return;
    }
    this.busy.set(true); this.error.set(''); this.message.set('');
    try {
      const created = await this.api.datasetCreate(this.name().trim(), this.examples());
      this.datasets.set(await this.api.datasetList());
      this.selectedDataset.set(created.datasetId);
      this.versions.set(await this.api.datasetVersions(created.datasetId));
      this.selectedVersion.set(created.id);
      this.loaded.set(await this.api.datasetRead(created.id));
      this.message.set('DATASET_SAVED');
    } catch (error) { this.error.set(this.messageOf(error)); }
    finally { this.busy.set(false); }
  }

  async selectDataset(id: string): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true); this.error.set(''); this.message.set('');
    this.selectedDataset.set(id); this.selectedVersion.set(''); this.loaded.set(null);
    try {
      this.versions.set(id ? await this.api.datasetVersions(id) : []);
      if (this.versions().length) await this.readVersionInternal(this.versions()[0].id);
    } catch (error) { this.error.set(this.messageOf(error)); }
    finally { this.busy.set(false); }
  }
  async selectVersion(id: string): Promise<void> {
    if (this.busy() || !id) return;
    this.busy.set(true); this.error.set('');
    try { await this.readVersionInternal(id); }
    catch (error) { this.error.set(this.messageOf(error)); }
    finally { this.busy.set(false); }
  }
  private async readVersionInternal(id: string): Promise<void> {
    const loaded = await this.api.datasetRead(id);
    this.selectedVersion.set(id);
    this.loaded.set(loaded);
    this.name.set(loaded.name);
    this.draft.set([...loaded.trainingExamples, ...loaded.validationExamples].join('\n'));
  }
  onDataset(event: Event): void { void this.selectDataset((event.target as HTMLSelectElement).value); }
  onVersion(event: Event): void { void this.selectVersion((event.target as HTMLSelectElement).value); }

  async revise(): Promise<void> {
    if (this.busy() || !this.selectedDataset()) return;
    if (!this.valid()) { this.error.set('INVALID_DATASET_INPUT'); return; }
    this.busy.set(true); this.error.set(''); this.message.set('');
    try {
      const version = await this.api.datasetRevise(this.selectedDataset(), this.examples());
      this.versions.set(await this.api.datasetVersions(this.selectedDataset()));
      this.datasets.set(await this.api.datasetList());
      this.selectedVersion.set(version.id);
      this.loaded.set(await this.api.datasetRead(version.id));
      this.message.set('NEW_VERSION_SAVED');
    } catch (error) { this.error.set(this.messageOf(error)); }
    finally { this.busy.set(false); }
  }

  async train(): Promise<void> {
    if (this.busy() || !this.loaded()) return;
    if (!Number.isInteger(this.epochs()) || this.epochs() < 1 || this.epochs() > 100) {
      this.error.set('INVALID_EPOCHS'); return;
    }
    this.busy.set(true); this.error.set(''); this.message.set('');
    try {
      const current = await this.monitor.refresh();
      if (current.status === 'RUNNING') throw new Error('TRAINING_ALREADY_RUNNING');
      this.monitor.report(await this.api.start([...this.loaded()!.trainingExamples], this.epochs()));
      this.trainingStarted.set(true);
      this.message.set('TRAINING_STARTED');
    } catch (error) { this.error.set(this.messageOf(error)); }
    finally { this.busy.set(false); }
  }
  async evaluate(): Promise<void> {
    if (this.busy() || !this.loaded()) return;
    this.busy.set(true); this.error.set(''); this.message.set('');
    try {
      const evaluation = await this.api.evaluate([...this.loaded()!.validationExamples]);
      this.message.set(`Cross-Entropy: ${evaluation.meanCrossEntropy.toFixed(6)} · Perplexity: ${evaluation.perplexity.toFixed(6)}`);
    } catch (error) { this.error.set(this.messageOf(error)); }
    finally { this.busy.set(false); }
  }
}
