'use strict';
/** Stage 21.3: opt-in voice dialogue translations; preserve existing user content. */
const fs = require('node:fs');
const path = require('node:path');
const root = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(__dirname, '..');
const translations = {
  pl: {
    'voice.conversation.enable': 'Włącz rozmowę głosową',
    'voice.conversation.disable': 'Wyłącz rozmowę głosową',
    'voice.conversation.stop': 'Przerwij głos',
    'voice.conversation.off': 'Tryb rozmowy jest wyłączony',
    'voice.conversation.ready': 'Tryb rozmowy aktywny — kliknij mikrofon, aby mówić',
    'voice.conversation.thinking': 'Qwen przygotowuje odpowiedź…',
    'voice.conversation.synthesizing': 'Piper przygotowuje odczyt odpowiedzi…',
    'voice.conversation.readyToPlay': 'Nagranie jest gotowe — kliknij odtwarzanie przy odpowiedzi',
    'voice.conversation.speaking': 'J.A.R.V.I.S. odczytuje odpowiedź…',
    'voice.conversation.paused': 'Głos J.A.R.V.I.S. jest wstrzymany',
    'voice.conversation.busy': 'Rozmowa jest zajęta; spróbuj ponownie po zakończeniu odpowiedzi',
    'voice.conversation.sendFailed': 'Nie udało się wysłać wypowiedzi do Qwen; tekst zachowano w polu Chat',
    'voice.conversation.answerUnavailable': 'Odpowiedź modelu nie jest dostępna do odczytu',
    'voice.conversation.ttsUnavailable': 'Wiadomość wysłana, ale lokalny Piper jest niedostępny',
    'voice.conversation.speechFailed': 'Odpowiedź zapisana w Chat, lecz nie udało się jej odczytać',
    'voice.conversation.notice': 'Rozmowa głosowa działa tylko po włączeniu. Każdą wypowiedź nagrywasz ręcznie. Przerwanie nie cofa wiadomości już wysłanej do Qwen.',
    'voice.conversation.privacy': 'W trybie rozmowy tekst z Whisper jest automatycznie wysyłany do lokalnego Qwen, a odpowiedź może zostać odczytana przez Piper.',
  },
  en: {
    'voice.conversation.enable': 'Enable voice conversation',
    'voice.conversation.disable': 'Disable voice conversation',
    'voice.conversation.stop': 'Stop voice',
    'voice.conversation.off': 'Voice conversation is off',
    'voice.conversation.ready': 'Voice mode enabled — press the microphone to speak',
    'voice.conversation.thinking': 'Qwen is preparing a reply…',
    'voice.conversation.synthesizing': 'Piper is preparing speech…',
    'voice.conversation.readyToPlay': 'Speech is ready — use play on the reply',
    'voice.conversation.speaking': 'J.A.R.V.I.S. is speaking…',
    'voice.conversation.paused': 'J.A.R.V.I.S. speech is paused',
    'voice.conversation.busy': 'Conversation is busy. Try again after the reply finishes',
    'voice.conversation.sendFailed': 'Could not send speech to Qwen; text was preserved in Chat input',
    'voice.conversation.answerUnavailable': 'Model reply is not available for speech',
    'voice.conversation.ttsUnavailable': 'Message was sent, but local Piper is unavailable',
    'voice.conversation.speechFailed': 'Reply saved in Chat, but could not be spoken',
    'voice.conversation.notice': 'Voice mode requires explicit opt-in. Start each recording manually. Stopping cannot undo a message already sent to Qwen.',
    'voice.conversation.privacy': 'In conversation mode, Whisper text is automatically sent to local Qwen; Piper may read the reply aloud.',
  },
};

const insertBefore = (text, anchor, value, label) => {
  if (!text.includes(anchor)) throw new Error(`STAGE_21_3_EXPECTED:${label}`);
  return text.replace(anchor, value + anchor);
};
const replace = (text, anchor, value, label) => {
  if (!text.includes(anchor)) throw new Error(`STAGE_21_3_EXPECTED:${label}`);
  return text.replace(anchor, value);
};

/** Preserve existing text and line endings; insert only the new 21.3 blocks. */
function integrateChatViewTs(original) {
  if (original.includes('JARVIS_21_3_VIEW')) return original;
  let s = insertBefore(original, "import { ChatSpeech }", "// JARVIS_21_3_VIEW\nimport { ChatVoiceMode } from '../chat-voice-mode/chat-voice-mode';\nimport { VoiceConversationService } from '../../../core/services/voice-conversation';\n", 'chat-view imports');
  s = replace(s, 'imports: [TranslatePipe, ChatRagSources, ChatVoice, ChatSpeech]', 'imports: [TranslatePipe, ChatRagSources, ChatVoice, ChatSpeech, ChatVoiceMode]', 'ChatView.imports');
  s = replace(s, '  readonly store = inject(ChatStore);', '  readonly store = inject(ChatStore);\n  readonly voiceConversation = inject(VoiceConversationService);\n  readonly voiceRecorder = viewChild(ChatVoice);', 'ChatView.store');
  s = replace(s, '      this.scrollScheduler.cancel();', '      this.scrollScheduler.cancel();\n      if (this.voiceConversation.enabled()) this.voiceConversation.disable();', 'ChatView.destroy');
  s = insertBefore(s, '  async sendMessage(): Promise<void> {', `  /** Switching modes never automatically starts a microphone. */
  toggleVoiceConversation(): void {
    if (this.voiceConversation.enabled()) {
      this.voiceRecorder()?.cancel();
      this.voiceConversation.disable();
      return;
    }
    if (this.store.loading() || this.store.sending() || this.store.busy() ||
        !this.voiceRecorder()?.configured() || this.voiceRecorder()?.state() !== 'idle') return;
    this.voiceConversation.enable();
  }

  /** Stop microphone and local audio; server-side Qwen may still finish. */
  stopVoiceConversation(): void {
    this.voiceRecorder()?.cancel();
    this.voiceConversation.stop();
  }

  async onVoiceText(text: string): Promise<void> {
    if (!this.voiceConversation.enabled()) {
      this.addVoiceDraft(text);
      return;
    }
    const clean = text.trim();
    if (!clean) return;
    this.pendingText.set(clean);
    try {
      const result = await this.voiceConversation.acceptTranscript(clean);
      if (result === 'failed' && !this.draft()) this.draft.set(clean);
    } finally {
      this.pendingText.set('');
    }
  }

`, 'ChatView.sendMessage');
  s = replace(s, '  newChat(): void { this.store.newChat(); }', `  newChat(): void {
    if (this.voiceConversation.enabled()) this.voiceConversation.disable();
    this.store.newChat();
  }`, 'ChatView.newChat');
  // Match either CRLF or LF without rewriting surrounding lines.
  const deleteMatch = /    this\.cancelDelete\(\);(\r?\n)    await this\.store\.removeActiveChat\(\);/;
  if (!deleteMatch.test(s)) throw new Error('STAGE_21_3_EXPECTED:ChatView.delete');
  s = s.replace(deleteMatch, (_all, eol) => `    this.cancelDelete();${eol}    if (this.voiceConversation.enabled()) this.voiceConversation.disable();${eol}    await this.store.removeActiveChat();`);
  return s;
}
function integrateChatViewHtml(original) {
  if (original.includes('JARVIS_21_3_VIEW_HTML')) return original;
  return replace(original, '    <app-chat-voice (textReady)="addVoiceDraft($event)" />', `    <!-- JARVIS_21_3_VIEW_HTML -->
    <app-chat-voice-mode
      [voiceReady]="voiceRecorder()?.configured() === true"
      [recording]="voiceRecorder()?.state() !== 'idle'"
      (toggleRequested)="toggleVoiceConversation()"
      (stopRequested)="stopVoiceConversation()" />
    <app-chat-voice [autoSend]="voiceConversation.enabled()" (textReady)="onVoiceText($event)" />`, 'ChatView.voice');
}
function integrateRecorderTs(original) {
  if (original.includes('JARVIS_21_3_VOICE')) return original;
  let s = replace(original, 'effect, inject, output, signal', 'effect, inject, input, output, signal', 'ChatVoice.imports');
  s = replace(s, '  readonly textReady = output<string>();', '  // JARVIS_21_3_VOICE\n  readonly textReady = output<string>();\n  readonly autoSend = input(false);', 'ChatVoice.output');
  return s;
}
function integrateRecorderHtml(original) {
  if (original.includes('JARVIS_21_3_VOICE_HTML')) return original;
  return replace(original, `<p class="voice-dictation__notice">{{ 'voice.privacy' | translate }}</p>`, `<!-- JARVIS_21_3_VOICE_HTML -->
  <p class="voice-dictation__notice">
    {{ (autoSend() ? 'voice.conversation.privacy' : 'voice.privacy') | translate }}
  </p>`, 'ChatVoice.privacy');
}

try {
  const plans = Object.entries(translations).map(([lang, values]) => {
    const file = path.join(root, 'public', 'i18n', `${lang}.json`);
    if (!fs.existsSync(file)) throw new Error(`STAGE_21_3_MISSING:${file}`);
    const original = fs.readFileSync(file, 'utf8');
    const dict = JSON.parse(original);
    for (const key of ['voice.start', 'tts.pause', 'tts.resume', 'tts.read']) {
      if (typeof dict[key] !== 'string') throw new Error(`STAGE_21_3_REQUIRES_21_2:${key}`);
    }
    for (const [key, text] of Object.entries(values)) {
      if (key in dict && typeof dict[key] !== 'string') throw new Error(`STAGE_21_3_CONFLICT:${key}`);
      dict[key] ??= text;
    }
    const complete = Object.keys(values).every(key => typeof JSON.parse(original)[key] === 'string');
    const eol = original.includes('\r\n') ? '\r\n' : '\n';
    return { file, original, next: complete ? original : JSON.stringify(dict, null, 2).replaceAll('\n', eol) + eol };
  });
  const targetFiles = [
    ['src/app/features/chat/chat-view/chat-view.ts', integrateChatViewTs],
    ['src/app/features/chat/chat-view/chat-view.html', integrateChatViewHtml],
    ['src/app/features/chat/chat-voice/chat-voice.ts', integrateRecorderTs],
    ['src/app/features/chat/chat-voice/chat-voice.html', integrateRecorderHtml],
  ];
  for (const [relative, transform] of targetFiles) {
    const file = path.join(root, relative);
    if (!fs.existsSync(file)) throw new Error(`STAGE_21_3_MISSING:${file}`);
    const original = fs.readFileSync(file, 'utf8');
    plans.push({ file, original, next: transform(original) });
  }
  // All changes have been validated before writing anything.
  for (const { file, original, next } of plans) {
    if (original === next) continue;
    const backup = `${file}.backup-before-stage21-3`;
    if (!fs.existsSync(backup)) fs.copyFileSync(file, backup, fs.constants.COPYFILE_EXCL);
    fs.writeFileSync(file, next, 'utf8');
  }
  console.log('STAGE_21_3_OK: voice dialogue integrated, PL/EN translations preserved');
} catch (error) {
  console.error('STAGE_21_3_ABORTED:', error.message);
  process.exitCode = 1;
}
