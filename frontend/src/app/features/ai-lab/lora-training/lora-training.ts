import { ChangeDetectionStrategy, Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { LoraTrainingService, LoraRun } from '../../../core/services/lora-training';
import { LoraEvidenceApi,LoraDataset } from '../../../core/services/lora-evidence';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-lora-training', standalone: true,
  imports: [TranslatePipe],
  templateUrl: './lora-training.html',
  styleUrl: './lora-training.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoraTraining implements OnInit, OnDestroy {
  private readonly api = inject(LoraTrainingService);
  private readonly evidenceApi = inject(LoraEvidenceApi);
  readonly datasetId = signal('');
  readonly reviewed = signal<LoraDataset[]>([]);
  readonly current = signal<LoraRun | null>(null);
  readonly history = signal<LoraRun[]>([]);
  readonly steps = signal(6);
  readonly seqLen = signal(128);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly running = computed(() => !!this.current()?.processAlive);
  readonly percent = computed(() => {
    const run = this.current();
    return run?.totalSteps ? Math.min(100, Math.round(run.step / run.totalSteps * 100)) : 0;
  });
  private timer?: ReturnType<typeof setInterval>;
  private refreshing = false;

  ngOnInit(): void {
    void this.refresh();
    void this.loadDatasets();
    this.timer = setInterval(() => { if (this.running()) void this.refresh(); }, 2500);
  }
  ngOnDestroy(): void { if (this.timer) clearInterval(this.timer); }
  setDataset(event: Event): void { this.datasetId.set((event.target as HTMLSelectElement).value); }
  setSteps(event: Event): void { this.steps.set(Number((event.target as HTMLInputElement).value)); }
  setSeqLen(event: Event): void { this.seqLen.set(Number((event.target as HTMLSelectElement).value)); }
  async refresh(): Promise<void> {
    if (this.refreshing) return;
    this.refreshing = true;
    try {
      this.current.set(await this.api.status());
      this.history.set(await this.api.history());
      this.error.set('');
    } catch { this.error.set('lab.lora.unavailable'); }
    finally { this.refreshing = false; }
  }
  async loadDatasets(): Promise<void> {
    try { this.reviewed.set(await this.api.datasets()); } catch { this.reviewed.set([]); }
  }
  async start(): Promise<void> {
    if (this.busy() || this.running()) return;
    if (!Number.isInteger(this.steps()) || this.steps() < 1 || this.steps() > 200 ||
        ![64, 128, 256, 512].includes(this.seqLen())) { this.error.set('lab.lora.validation'); return; }
    this.busy.set(true); this.error.set('');
    try { this.current.set(await this.api.start(this.steps(), this.seqLen(), this.datasetId() || undefined)); await this.refresh(); }
    catch { this.error.set('lab.lora.startError'); }
    finally { this.busy.set(false); }
  }
  async stop(): Promise<void> {
    if (this.busy() || !this.running()) return;
    this.busy.set(true);
    try { this.current.set(await this.api.stop()); await this.refresh(); }
    catch { this.error.set('lab.lora.stopError'); }
    finally { this.busy.set(false); }
  }
}
