import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { AiLabApiService, LabModelStatus, LabTrainingState } from '../../../core/services/ai-lab-api';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { AiLabHistoryPanel } from '../history-panel/history-panel';
import { AiLabDatasetPanel } from '../dataset-panel/dataset-panel';

@Component({
  selector: 'app-ai-training-panel',
  imports: [TranslatePipe, AiLabHistoryPanel, AiLabDatasetPanel],
  templateUrl: './training-panel.html',
  styleUrl: './training-panel.scss',
})
export class AiTrainingPanel implements OnInit, OnDestroy {
  private readonly api = inject(AiLabApiService);
  readonly state = signal<LabTrainingState | null>(null);
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
  private polling?: ReturnType<typeof setInterval>;
  private refreshing = false;

  ngOnInit(): void {
    void this.refresh();
    this.polling = setInterval(() => {
      if (this.state()?.status === 'RUNNING') void this.refresh();
    }, 1000);
  }
  ngOnDestroy(): void { if (this.polling) clearInterval(this.polling); }

  onText(event: Event): void { this.text.set((event.target as HTMLTextAreaElement).value); }
  onEpochs(event: Event): void { this.epochs.set(Number((event.target as HTMLInputElement).value)); }

  private examples(): string[] { return this.text().split(/\r?\n/).map(s => s.trim()).filter(Boolean); }

  async refresh(): Promise<void> {
    if (!this.api.available) { this.error.set('DESKTOP_BRIDGE_UNAVAILABLE'); return; }
    if (this.refreshing) return;
    this.refreshing = true;
    try {
      const state = await this.api.state();
      this.state.set(state);
      // Model reads lock the tiny Transformer; do not call on each training poll.
      if (state.status !== 'RUNNING') this.model.set(await this.api.model());
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
    try { this.state.set(await this.api.start(examples, this.epochs())); }
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
