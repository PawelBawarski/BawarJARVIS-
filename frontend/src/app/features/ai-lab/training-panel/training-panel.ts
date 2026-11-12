import { ChangeDetectionStrategy, Component, computed, effect, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { AiLabApiService, LabModelStatus, LabTrainingState } from '../../../core/services/ai-lab-api';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { LabTrainingMonitor } from '../../../core/services/lab-training-monitor';
import { AiLabHistoryPanel } from '../history-panel/history-panel';
import { AiLabDatasetPanel } from '../dataset-panel/dataset-panel';

@Component({
  selector: 'app-ai-training-panel',
  imports: [TranslatePipe, AiLabHistoryPanel, AiLabDatasetPanel],
  templateUrl: './training-panel.html',
  styleUrl: './training-panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AiTrainingPanel implements OnInit, OnDestroy {
  private readonly api = inject(AiLabApiService);
  private readonly monitor = inject(LabTrainingMonitor);
  readonly state = this.monitor.state;
  readonly pollingError = this.monitor.pollingError;
  readonly model = signal<LabModelStatus | null>(null);
  readonly text = signal('ala\nala ma kota');
  readonly epochs = signal(3);
  readonly error = signal('');
  readonly pending = signal(false);
  readonly isRunning = computed(() => this.pending() || this.state()?.status === 'RUNNING');
  readonly progressPercent = computed(() => {
    const x = this.state();
    return x && x.totalEpochs ? Math.round(x.epoch * 100 / x.totalEpochs) : 0;
  });
  private refreshing = false;
  private lastTerminalRun = '';
  private modelRequest?: Promise<LabModelStatus>;

  constructor() {
    // A completed job may have changed checkpoint availability. Polling itself
    // stays read-only; refresh model metadata only once per terminal transition.
    effect(() => {
      const state = this.state();
      if (!state || (state.status !== 'COMPLETED' && state.status !== 'FAILED')) return;
      const key = `${state.id}:${state.status}`;
      if (key === this.lastTerminalRun) return;
      this.lastTerminalRun = key;
      void this.loadModel().catch(() => undefined);
    });
  }

  private loadModel(): Promise<LabModelStatus> {
    if (this.modelRequest) return this.modelRequest;
    const request = this.api.model().then(model => {
      this.model.set(model);
      return model;
    });
    this.modelRequest = request.finally(() => { this.modelRequest = undefined; });
    return this.modelRequest;
  }

  ngOnInit(): void {
    this.monitor.acquire();
    void this.refresh();
  }
  ngOnDestroy(): void { this.monitor.release(); }

  onText(event: Event): void { this.text.set((event.target as HTMLTextAreaElement).value); }
  onEpochs(event: Event): void { this.epochs.set(Number((event.target as HTMLInputElement).value)); }

  private examples(): string[] { return this.text().split(/\r?\n/).map(s => s.trim()).filter(Boolean); }

  async refresh(): Promise<void> {
    if (!this.api.available) { this.error.set('DESKTOP_BRIDGE_UNAVAILABLE'); return; }
    if (this.refreshing) return;
    this.refreshing = true;
    try {
      const state = await this.monitor.refresh();
      // Model reads lock the tiny Transformer; do not call on each training poll.
      if (state.status !== 'RUNNING') await this.loadModel();
      this.error.set('');
    } catch (e) { this.error.set(this.message(e)); }
    finally { this.refreshing = false; }
  }

  async start(): Promise<void> {
    if (this.isRunning()) return;
    const examples = this.examples();
    if (!Number.isInteger(this.epochs()) || this.epochs() < 1 || this.epochs() > 100 ||
        examples.length < 1 || examples.length > 100 || examples.some(s => s.length > 256)) {
      this.error.set('INVALID_TRAINING_INPUT'); return;
    }
    this.pending.set(true); this.error.set('');
    try { this.monitor.report(await this.api.start(examples, this.epochs())); }
    catch (e) { this.error.set(this.message(e)); }
    finally { this.pending.set(false); }
  }

  async save(): Promise<void> {
    if (this.isRunning()) return;
    this.pending.set(true); this.error.set('');
    try { this.model.set(await this.api.save()); }
    catch (e) { this.error.set(this.message(e)); }
    finally { this.pending.set(false); }
  }

  async load(): Promise<void> {
    if (this.isRunning()) return;
    this.pending.set(true); this.error.set('');
    try { this.model.set(await this.api.load()); }
    catch (e) { this.error.set(this.message(e)); }
    finally { this.pending.set(false); }
  }

  private message(e: unknown): string { return e instanceof Error ? e.message : 'REQUEST_FAILED'; }
}
