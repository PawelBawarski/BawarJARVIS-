'use strict';
/** Stage 21.1: verify every target before making changes, then keep backups. */
const fs = require('node:fs');
const path = require('node:path');
const root = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(__dirname, '..');
const files = [
  'src/app/features/chat/chat-view/chat-view.ts',
  'src/app/features/chat/chat-view/chat-view.html',
  'scripts/dev-stack.cjs',
  'public/i18n/pl.json',
  'public/i18n/en.json',
];
const translations = {
  pl: {
    'tts.read': 'Odczytaj na głos',
    'tts.checking': 'Sprawdzanie lokalnego syntezatora…',
    'tts.unavailable': 'Piper nie jest jeszcze skonfigurowany. Uruchom instalator 21.1.',
    'tts.privacy': 'Głos powstaje lokalnie w Spring Boot. Audio nie jest zapisywane w historii.',
    'tts.stop': 'Zatrzymaj głos',
    'tts.playPrepared': 'Odtwórz przygotowany głos',
    'tts.generating': 'Piper przygotowuje dźwięk…',
    'tts.playing': 'Odtwarzanie lokalnego głosu…',
    'tts.error': 'Nie udało się wygenerować lub odtworzyć głosu.',
    'tts.tooLong': 'Ta wiadomość jest za długa do odczytania w wersji 21.1 (maks. 1200 znaków).',
  },
  en: {
    'tts.read': 'Read aloud',
    'tts.checking': 'Checking local text-to-speech…',
    'tts.unavailable': 'Piper is not configured yet. Run the 21.1 setup script.',
    'tts.privacy': 'Audio is generated locally in Spring Boot and is not stored in history.',
    'tts.stop': 'Stop voice',
    'tts.playPrepared': 'Play prepared audio',
    'tts.generating': 'Piper is preparing audio…',
    'tts.playing': 'Playing local audio…',
    'tts.error': 'Voice generation or playback failed.',
    'tts.tooLong': 'This message is too long for 21.1 (1200 characters maximum).',
  },
};
function requireText(text, marker, label) {
  if (!text.includes(marker)) throw new Error(`STAGE_21_1_UNEXPECTED_LAYOUT: ${label}`);
}
function ts(source) {
  const name = "import { ChatSpeech } from '../chat-speech/chat-speech';";
  if (!source.includes(name)) source = name + '\n' + source;
  if (!/imports:\s*\[[^\]]*ChatSpeech/.test(source)) {
    const match = source.match(/imports:\s*\[([^\]]*)\]/);
    if (!match) throw new Error('STAGE_21_1_IMPORTS_MISSING');
    source = source.replace(match[0], `imports: [${match[1].trim()}, ChatSpeech]`);
  }
  return source;
}
function html(source) {
  const snippet = '        @if (message.role === \'assistant\') {\n          <app-chat-speech [messageId]="message.id" [text]="message.content" />\n        }';
  if (!source.includes('<app-chat-speech')) {
    const marker = '        <p>{{ message.content }}</p>';
    requireText(source, marker, 'Chat assistant message');
    source = source.replace(marker, marker + '\n' + snippet);
  }
  return source;
}
function stack(source) {
  if (!source.includes('PIPER_ENABLED|PIPER_PATH|PIPER_MODEL_PL|PIPER_MODEL_EN')) {
    const marker = 'WHISPER_CLI_PATH|WHISPER_MODEL_PATH';
    requireText(source, marker, 'dev-stack .env parser');
    source = source.replace(marker, marker + '|PIPER_ENABLED|PIPER_PATH|PIPER_MODEL_PL|PIPER_MODEL_EN');
  }
  if (!source.includes("key === 'JARVIS_PIPER_ENABLED'")) {
    const marker = "key === 'JARVIS_WHISPER_MODEL_PATH'";
    requireText(source, marker, 'dev-stack accepted env keys');
    source = source.replace(marker, marker + " || key === 'JARVIS_PIPER_ENABLED' || key === 'JARVIS_PIPER_PATH' || key === 'JARVIS_PIPER_MODEL_PL' || key === 'JARVIS_PIPER_MODEL_EN'");
  }
  return source;
}
function dict(source, language) {
  const json = JSON.parse(source);
  for (const [key, value] of Object.entries(translations[language])) {
    if (key in json && typeof json[key] !== 'string') throw new Error(`STAGE_21_1_TRANSLATION_CONFLICT:${key}`);
    json[key] ??= value;
  }
  if (Object.keys(translations[language]).every(key => source.includes(`"${key}"`))) return source;
  const eol = source.includes('\r\n') ? '\r\n' : '\n';
  return JSON.stringify(json, null, 2).replaceAll('\n', eol) + eol;
}
try {
  for (const item of files) if (!fs.existsSync(path.join(root, item))) throw new Error('STAGE_21_1_MISSING:' + item);
  const transformers = [ts, html, stack, s => dict(s, 'pl'), s => dict(s, 'en')];
  const plans = files.map((name, index) => {
    const file = path.join(root, name);
    const old = fs.readFileSync(file, 'utf8');
    return { file, old, next: transformers[index](old) };
  });
  let count = 0;
  for (const { file, old, next } of plans) {
    if (old === next) continue;
    const backup = file + '.backup-before-stage21-1';
    if (!fs.existsSync(backup)) fs.copyFileSync(file, backup, fs.constants.COPYFILE_EXCL);
    fs.writeFileSync(file, next);
    count++;
  }
  console.log(`STAGE_21_1_OK: modified ${count} files, original backups kept`);
} catch (error) {
  console.error('STAGE_21_1_ABORTED:', error.message);
  process.exitCode = 1;
}
