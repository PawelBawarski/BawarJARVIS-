import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { ChatStore } from '../../../core/services/chat-store';
import { VoiceConversationService } from '../../../core/services/voice-conversation';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
// JARVIS_21_4_MODE
import { VoiceDiagnostics } from '../voice-diagnostics/voice-diagnostics';

/** Voice-mode toggle is separate from the push-to-talk recorder and Chat composer. */
@Component({
  selector: 'app-chat-voice-mode',
  imports: [TranslatePipe, VoiceDiagnostics],
  templateUrl: './chat-voice-mode.html',
  styleUrl: './chat-voice-mode.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatVoiceMode {
  readonly voiceReady = input(false);
  readonly recording = input(false);
  readonly toggleRequested = output<void>();
  readonly stopRequested = output<void>();
  readonly store = inject(ChatStore);
  readonly voice = inject(VoiceConversationService);
}
