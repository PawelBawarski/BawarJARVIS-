'use strict';
/** Non-destructive, repeatable integration with the existing Chat and local dev stack. */
const fs = require('node:fs');
const path = require('node:path');
const root = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(__dirname, '..');
const existing = [
  'src/app/features/chat/chat-view/chat-view.ts',
  'src/app/features/chat/chat-view/chat-view.html',
  'scripts/dev-stack.cjs',
  'public/i18n/pl.json',
  'public/i18n/en.json',
];

const dictionary = {
  pl: {
    'voice.start': 'Nagraj głosem',
    'voice.stop': 'Zatrzymaj i rozpoznaj',
    'voice.cancel': 'Anuluj',
    'voice.refresh': 'Sprawdź dostępność rozpoznawania mowy',
    'voice.ready': 'Whisper skonfigurowany — nagranie uruchamiasz ręcznie',
    'voice.offline': 'Rozpoznawanie mowy wyłączone lub nieskonfigurowane',
    'voice.permission': 'Oczekiwanie na zgodę na mikrofon…',
    'voice.recording': 'Nagrywanie… maksymalnie 15 sekund',
    'voice.transcribing': 'Lokalny Whisper rozpoznaje nagranie…',
    'voice.privacy': 'Nagranie trafia wyłącznie do lokalnego Spring Boot. Tekst pojawi się w polu Chat, ale nie zostanie wysłany automatycznie.',
    'voice.error.permission': 'Nie uzyskano dostępu do mikrofonu.',
    'voice.error.unsupported': 'Ta przeglądarka nie obsługuje nagrywania mikrofonu.',
    'voice.error.short': 'Nagranie jest zbyt krótkie. Spróbuj ponownie.',
    'voice.error.unavailable': 'Lokalny Whisper nie rozpoznał nagrania. Sprawdź konfigurację.',
  },
  en: {
    'voice.start': 'Dictate message',
    'voice.stop': 'Stop and transcribe',
    'voice.cancel': 'Cancel',
    'voice.refresh': 'Check speech recognition availability',
    'voice.ready': 'Whisper configured — recording starts only when you choose',
    'voice.offline': 'Speech recognition is off or not configured',
    'voice.permission': 'Waiting for microphone permission…',
    'voice.recording': 'Recording… up to 15 seconds',
    'voice.transcribing': 'Local Whisper is transcribing audio…',
    'voice.privacy': 'Audio is sent only to local Spring Boot. The transcript fills Chat without automatically sending your message.',
    'voice.error.permission': 'Microphone access was denied or unavailable.',
    'voice.error.unsupported': 'Microphone recording is unsupported in this browser.',
    'voice.error.short': 'Recording is too short. Please try again.',
    'voice.error.unavailable': 'Local Whisper could not transcribe the recording. Check the configuration.',
  },
};

function update(relative, modify) {
  const file = path.join(root, relative);
  const previous = fs.readFileSync(file, 'utf8');
  const next = modify(previous);
  if (typeof next !== 'string') throw new Error(`INVALID_TRANSFORM: ${relative}`);
  return { file, previous, next };
}
function requireFragment(source, fragment, label) {
  if (!source.includes(fragment)) throw new Error(`STAGE21_UNEXPECTED_FILE: ${label}`);
}
function appTs(source) {
  if (!source.includes("import { ChatVoice } from '../chat-voice/chat-voice';")) {
    source = "import { ChatVoice } from '../chat-voice/chat-voice';\n" + source;
  }
  if (!/imports:\s*\[[^\]]*ChatVoice/.test(source)) {
    const marker = source.match(/imports:\s*\[([^\]]+)\]/);
    if (!marker) throw new Error('STAGE21_CHAT_IMPORTS_MISSING');
    source = source.replace(marker[0], `imports: [${marker[1].trim()}, ChatVoice]`);
  }
  if (!source.includes('addVoiceDraft(text: string)')) {
    requireFragment(source, '  async sendMessage(): Promise<void> {', 'ChatView.sendMessage');
    source = source.replace('  async sendMessage(): Promise<void> {',
      '  /** Never send a transcription to Qwen without a separate user click. */\n' +
      '  addVoiceDraft(text: string): void {\n' +
      '    if (!text.trim()) return;\n' +
      '    this.draft.update(current => [current.trim(), text.trim()].filter(Boolean).join(" ").slice(0, 4000));\n' +
      '  }\n\n  async sendMessage(): Promise<void> {');
  }
  return source;
}
function appHtml(source) {
  const voice = '    <app-chat-voice (textReady)="addVoiceDraft($event)" />';
  if (!source.includes(voice)) {
    requireFragment(source, '<footer class="chat-footer">', 'Chat footer');
    source = source.replace('<footer class="chat-footer">', `<footer class="chat-footer">\n${voice}`);
  }
  return source;
}
function devStack(source) {
  if (!source.includes('WHISPER_CLI_PATH')) {
    const existing = source.match(/AGENT_\(\?:WORKSPACE_ROOT\|FILE_WRITES_ENABLED(?:\|TESTS_ENABLED)?\)/)?.[0];
    if (!existing) throw new Error('STAGE21_UNEXPECTED_FILE: dev-stack env loader');
    source = source.replace(existing,
      `${existing}|VOICE_ENABLED|WHISPER_CLI_PATH|WHISPER_MODEL_PATH`);
  }
  if (!source.includes("key === 'JARVIS_VOICE_ENABLED'")) {
    requireFragment(source, "key.startsWith('JARVIS_AGENT_')", 'dev-stack env override');
    source = source.replace("key.startsWith('JARVIS_AGENT_')",
      "key.startsWith('JARVIS_AGENT_') || key === 'JARVIS_VOICE_ENABLED' || " +
      "key === 'JARVIS_WHISPER_CLI_PATH' || key === 'JARVIS_WHISPER_MODEL_PATH'");
  }
  return source;
}
function translate(source, language) {
  const object = JSON.parse(source);
  const missing = Object.entries(dictionary[language]).filter(([key]) => !(key in object));
  for (const [key] of Object.entries(dictionary[language])) {
    if (key in object && typeof object[key] !== 'string')
      throw new Error('STAGE21_TRANSLATION_CONFLICT: ' + key);
  }
  if (!missing.length) return source;
  const eol = source.includes('\r\n') ? '\r\n' : '\n';
  const end = source.lastIndexOf('}');
  if (end < 0) throw new Error('STAGE21_INVALID_TRANSLATIONS');
  const prefix = source.slice(0, end).trimEnd();
  const comma = prefix.endsWith('{') ? '' : ',';
  const next = prefix + comma + eol + missing.map(([key, value]) =>
    `  ${JSON.stringify(key)}: ${JSON.stringify(value)}`).join(',' + eol) + eol + source.slice(end);
  JSON.parse(next);
  return next;
}

try {
  for (const name of existing) if (!fs.existsSync(path.join(root, name))) throw new Error('STAGE21_FILE_MISSING: ' + name);
  const plans = [
    update(existing[0], appTs), update(existing[1], appHtml), update(existing[2], devStack),
    update(existing[3], src => translate(src, 'pl')), update(existing[4], src => translate(src, 'en')),
  ];
  // All validation above finishes before touching disk.
  let changed = 0;
  for (const plan of plans) {
    if (plan.previous === plan.next) continue;
    const backup = plan.file + '.backup-before-stage21-0';
    if (!fs.existsSync(backup)) fs.copyFileSync(plan.file, backup, fs.constants.COPYFILE_EXCL);
    fs.writeFileSync(plan.file, plan.next, 'utf8');
    changed++;
  }
  console.log(`STAGE_21_0_OK: updated ${changed} files; voice disabled by default.`);
} catch (err) {
  console.error('STAGE_21_0_ABORTED:', err.message);
  process.exitCode = 1;
}
