import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { VoicePipelineDiagnostics, VoiceEngineHealth } from '../../../core/services/voice-pipeline-diagnostics';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';

/** The user decides when to check local STT, Chat and TTS status. */
@Component({
  selector: 'app-voice-diagnostics',
  imports: [TranslatePipe],
  templateUrl: './voice-diagnostics.html',
  styleUrl: './voice-diagnostics.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VoiceDiagnostics {
  readonly engines = inject(VoicePipelineDiagnostics);
  readonly expanded = signal(false);

  openOrRefresh(): void {
    this.expanded.set(true);
    void this.engines.refresh();
  }

  statusKey(state: VoiceEngineHealth): string {
    return `voice.health.${state}`;
  }
}
