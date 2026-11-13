'use strict';
/** Final Voice V1 hardening: retry Piper availability + opt-in engine diagnostics. */
const fs = require('node:fs');
const path = require('node:path');
const rootArg = process.argv.slice(2).find(arg => arg !== '--check');
const root = rootArg ? path.resolve(rootArg) : path.resolve(__dirname, '..');
const updates = {
  pl: {
    'voice.health.refresh': 'Sprawdź silniki głosowe',
    'voice.health.checking': 'Sprawdzanie silników…',
    'voice.health.whisper': 'Whisper — mikrofon',
    'voice.health.qwen': 'Qwen — odpowiedzi',
    'voice.health.piperPl': 'Piper — polski',
    'voice.health.piperEn': 'Piper — angielski',
    'voice.health.unknown': 'nie sprawdzono',
    'voice.health.ready': 'gotowy',
    'voice.health.offline': 'niedostępny',
    'voice.health.notice': 'Diagnostyka sprawdza tylko lokalne usługi. Nie nagrywa głosu ani nie wysyła wiadomości.',
  },
  en: {
    'voice.health.refresh': 'Check voice engines',
    'voice.health.checking': 'Checking engines…',
    'voice.health.whisper': 'Whisper — microphone',
    'voice.health.qwen': 'Qwen — responses',
    'voice.health.piperPl': 'Piper — Polish',
    'voice.health.piperEn': 'Piper — English',
    'voice.health.unknown': 'not checked',
    'voice.health.ready': 'ready',
    'voice.health.offline': 'unavailable',
    'voice.health.notice': 'Diagnostics only checks local services. It does not record audio or send messages.',
  },
};
const marker = 'JARVIS_21_4';

function replaceOnce(source, original, updated, label) {
  if (!source.includes(original)) throw new Error(`STAGE_21_4_EXPECTED:${label}`);
  return source.replace(original, updated);
}

function amendTtsPlayer(text) {
  if (text.includes(`${marker}_TTS_REFRESH`)) return text;

  // Match the method signature, not whitespace-dependent contents from 21.2.
  // Preserve all code outside the method and the original line-ending style.
  const declaration = /^([ \t]*)(?:(?:public|private|protected|override)\s+)*async\s+checkAvailability\s*\([^)]*\)\s*(?::\s*Promise\s*<\s*void\s*>)?\s*\{/m.exec(text);
  if (!declaration) throw new Error('STAGE_21_4_EXPECTED:LocalTtsPlayer.checkAvailability');
  const start = declaration.index;
  const indent = declaration[1];
  const opening = start + declaration[0].length - 1;
  let depth = 0;
  let end = -1;
  for (let i = opening; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}' && --depth === 0) { end = i + 1; break; }
  }
  if (end < 0) throw new Error('STAGE_21_4_EXPECTED:LocalTtsPlayer.checkAvailability.braces');
  const before = text.slice(start, end);
  if (!before.includes('this.api.status(') || !before.includes('this.available.set(')
      || !before.includes('this.checked.set(')) {
    throw new Error('STAGE_21_4_EXPECTED:LocalTtsPlayer.checkAvailability.body');
  }
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const replacement = `// ${marker}_TTS_REFRESH: allow forced retries while coalescing concurrent checks.
async checkAvailability(force = false): Promise<void> {
  if (this.statusPromise) return this.statusPromise;
  if (this.checked() && !force) return;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const pending = Promise.race([
    Promise.resolve().then(() => this.api.status()),
    new Promise<LocalTtsStatus>((_resolve, reject) => {
      timer = setTimeout(() => reject(new Error('TTS_STATUS_TIMEOUT')), 4_500);
    }),
  ]).then(status => this.available.set(status))
    .catch(() => this.available.set(null))
    .finally(() => {
      if (timer !== undefined) clearTimeout(timer);
      this.checked.set(true);
      this.statusPromise = null;
    });
  this.statusPromise = pending;
  return pending;
}`;
  return text.slice(0, start) + replacement.split('\n').map(line => indent + line).join(eol) + text.slice(end);
}

function amendConversation(text) {
  if (text.includes(`${marker}_VOICE_RECHECK`)) return text;
  return replaceOnce(text, '      await this.player.checkAvailability();',
    `      // ${marker}_VOICE_RECHECK: Piper may have started after an earlier failure.\n      await this.player.checkAvailability(true);`,
    'VoiceConversationService.checkAvailability');
}

function amendVoiceModeTs(text) {
  if (text.includes(`${marker}_MODE`)) return text;
  let result = replaceOnce(text,
    `import { TranslatePipe } from '../../../shared/pipes/translate.pipe';`,
    `import { TranslatePipe } from '../../../shared/pipes/translate.pipe';\n// ${marker}_MODE\nimport { VoiceDiagnostics } from '../voice-diagnostics/voice-diagnostics';`,
    'ChatVoiceMode.import');
  result = replaceOnce(result, 'imports: [TranslatePipe],', 'imports: [TranslatePipe, VoiceDiagnostics],', 'ChatVoiceMode.imports');
  return result;
}

function amendVoiceModeHtml(text) {
  if (text.includes(`${marker}_MODE_HTML`)) return text;
  const newline = text.includes('\r\n') ? '\r\n' : '\n';
  const addition = `  <!-- ${marker}_MODE_HTML -->${newline}  <app-voice-diagnostics />${newline}`;
  const pos = text.lastIndexOf('</section>');
  if (pos < 0) throw new Error('STAGE_21_4_EXPECTED:ChatVoiceMode.html');
  return text.slice(0, pos) + addition + text.slice(pos);
}

function stageTranslations(language) {
  const file = path.join(root, 'public', 'i18n', `${language}.json`);
  const original = fs.readFileSync(file, 'utf8');
  const dict = JSON.parse(original);
  for (const key of ['voice.conversation.enable', 'voice.conversation.disable', 'tts.read']) {
    if (typeof dict[key] !== 'string') throw new Error(`STAGE_21_4_REQUIRES_21_3:${key}`);
  }
  let modified = false;
  for (const [key, value] of Object.entries(updates[language])) {
    if (key in dict && typeof dict[key] !== 'string') throw new Error(`STAGE_21_4_CONFLICT:${key}`);
    if (!(key in dict)) { dict[key] = value; modified = true; }
  }
  const eol = original.includes('\r\n') ? '\r\n' : '\n';
  return { file, original, next: modified ? JSON.stringify(dict, null, 2).replaceAll('\n', eol) + eol : original };
}

function planFile(rel, transform) {
  const file = path.join(root, rel);
  const original = fs.readFileSync(file, 'utf8');
  return { file, original, next: transform(original) };
}

try {
  // Preflight *all* files before making any changes; never overwrite user translations.
  const changes = [
    planFile('src/app/core/services/local-tts-player.ts', amendTtsPlayer),
    planFile('src/app/core/services/voice-conversation.ts', amendConversation),
    planFile('src/app/features/chat/chat-voice-mode/chat-voice-mode.ts', amendVoiceModeTs),
    planFile('src/app/features/chat/chat-voice-mode/chat-voice-mode.html', amendVoiceModeHtml),
    stageTranslations('pl'), stageTranslations('en'),
  ];
  const changed = changes.filter(change => change.next !== change.original);
  if (process.argv.includes('--check')) {
    process.stdout.write(`STAGE_21_4_CHECK_OK: ${changed.length} changes pending\n`);
  } else {
    for (const change of changed) {
      const backup = `${change.file}.backup-before-stage21-4`;
      if (!fs.existsSync(backup)) fs.writeFileSync(backup, change.original, 'utf8');
      fs.writeFileSync(change.file, change.next, 'utf8');
    }
    process.stdout.write(`STAGE_21_4_OK: ${changed.length} files updated\n`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
