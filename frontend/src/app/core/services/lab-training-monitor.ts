import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, effect, inject, signal, untracked } from '@angular/core';
import { AiLabApiService, LabTrainingState } from './ai-lab-api';
import { ModuleNavigationService } from './module-navigation.service';

/**
 * One status request at a time, shared by the training and dataset panels.
 * Poll only while a running job is visible. No background work after closing AI Lab.
 * The backend remains the source of truth; this service never starts a job itself.
 */
@Injectable({ providedIn: 'root' })
export class LabTrainingMonitor {
  private readonly api = inject(AiLabApiService);
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly navigation = inject(ModuleNavigationService);

  readonly state = signal<LabTrainingState | null>(null);
  readonly pollingError = signal('');

  private owners = 0;
  private timer?: ReturnType<typeof setTimeout>;
  private inFlight?: Promise<LabTrainingState>;
  private revision = 0;
  private wasLabVisible?: boolean;
  private readonly intervalMs = 2_000;

  private readonly onVisibilityChange = () => {
    if (this.document.hidden) {
      this.cancelTimer();
    } else if (this.navigation.activeId() === 'lab' && this.owners && this.state()?.status === 'RUNNING') {
      // The browser may have throttled timers while hidden: check immediately on return.
      void this.refresh().catch(() => undefined);
    }
  };

  constructor() {
    // @defer retains the Lab component after visiting another route. Do not poll
    // while it is hidden by WorkspaceTabs, and resume on returning to /lab.
    effect(() => {
      const visibleModule = this.navigation.activeId() === 'lab';
      untracked(() => {
        const previous = this.wasLabVisible;
        this.wasLabVisible = visibleModule;
        if (!visibleModule) this.cancelTimer();
        else if (previous === false && this.owners && this.state()?.status === 'RUNNING' && !this.document.hidden) {
          void this.refresh().catch(() => undefined);
        }
      });
    });
    this.document.addEventListener('visibilitychange', this.onVisibilityChange);
    this.destroyRef.onDestroy(() => {
      this.cancelTimer();
      this.document.removeEventListener('visibilitychange', this.onVisibilityChange);
    });
  }

  acquire(): void {
    this.owners++;
    this.schedule();
  }

  release(): void {
    this.owners = Math.max(0, this.owners - 1);
    if (!this.owners) this.cancelTimer();
  }

  /** Called after POST /training; an older GET is not allowed to overwrite the new state. */
  report(state: LabTrainingState): void {
    this.revision++;
    this.state.set(state);
    this.pollingError.set('');
    this.schedule();
  }

  refresh(): Promise<LabTrainingState> {
    if (this.inFlight) return this.inFlight;
    this.cancelTimer();
    const revision = this.revision;
    const pending = Promise.resolve().then(() => this.api.state()).then(state => {
      if (revision === this.revision) this.state.set(state);
      this.pollingError.set('');
      return this.state() ?? state;
    }).catch((error: unknown) => {
      this.pollingError.set(error instanceof Error ? error.message : 'REQUEST_FAILED');
      throw error;
    });
    this.inFlight = pending.finally(() => {
      this.inFlight = undefined;
      this.schedule();
    });
    return this.inFlight;
  }

  private cancelTimer(): void {
    if (this.timer !== undefined) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
  }

  private schedule(): void {
    this.cancelTimer();
    if (!this.owners || this.navigation.activeId() !== 'lab' || this.document.hidden || this.inFlight || this.state()?.status !== 'RUNNING') return;
    // Self-scheduling timeout ensures a slow HTTP response cannot stack up requests.
    this.timer = setTimeout(() => {
      this.timer = undefined;
      if (this.document.hidden || this.navigation.activeId() !== 'lab' || !this.owners) return;
      void this.refresh().catch(() => undefined);
    }, this.intervalMs);
  }
}
