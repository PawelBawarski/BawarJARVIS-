import { Injectable, signal } from '@angular/core';
import { HelpTopic, MODULE_HELP } from '../../shared/module-help/module-help.data';

@Injectable({ providedIn: 'root' })
export class ModuleHelpService {
  private readonly selected = signal<HelpTopic | null>(null);
  readonly topic = this.selected.asReadonly();

  open(topic: string): void {
    const fallback: HelpTopic = 'chat';
    this.selected.set(Object.prototype.hasOwnProperty.call(MODULE_HELP, topic) ? topic as HelpTopic : fallback);
  }

  close(): void { this.selected.set(null); }
}
