'use strict';
/** Stage 21.2: install translations without changing users' existing values. */
const fs = require('node:fs');
const path = require('node:path');
const root = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(__dirname, '..');
const translations = {
  pl: {
    'tts.pause': 'Pauza',
    'tts.resume': 'Wznów',
    'tts.paused': 'Odtwarzanie wstrzymane',
    'tts.part': 'Fragment',
    'tts.tooLong21_2': 'Tekst przekracza limit odczytu 12 000 znaków.',
  },
  en: {
    'tts.pause': 'Pause',
    'tts.resume': 'Resume',
    'tts.paused': 'Playback paused',
    'tts.part': 'Part',
    'tts.tooLong21_2': 'This text exceeds the 12,000-character playback limit.',
  },
};
try {
  const plans = Object.entries(translations).map(([language, values]) => {
    const file = path.join(root, 'public', 'i18n', `${language}.json`);
    if (!fs.existsSync(file)) throw new Error(`STAGE_21_2_MISSING:${file}`);
    const original = fs.readFileSync(file, 'utf8');
    const json = JSON.parse(original);
    // Verify expected 21.1 base before modifying any files.
    for (const required of ['tts.read', 'tts.stop', 'tts.playPrepared']) {
      if (typeof json[required] !== 'string') throw new Error(`STAGE_21_2_REQUIRES_21_1:${required}`);
    }
    for (const [key, value] of Object.entries(values)) {
      if (key in json && typeof json[key] !== 'string') throw new Error(`STAGE_21_2_CONFLICT:${key}`);
      json[key] ??= value;
    }
    const eol = original.includes('\r\n') ? '\r\n' : '\n';
    const complete = Object.keys(values).every(key => original.includes(`"${key}"`));
    return { file, original, next: complete ? original : JSON.stringify(json, null, 2).replaceAll('\n', eol) + eol };
  });
  for (const { file, original, next } of plans) {
    if (original === next) continue;
    const backup = `${file}.backup-before-stage21-2`;
    if (!fs.existsSync(backup)) fs.copyFileSync(file, backup, fs.constants.COPYFILE_EXCL);
    fs.writeFileSync(file, next);
  }
  console.log('STAGE_21_2_OK: PL/EN voice controls installed, existing values preserved');
} catch (error) {
  console.error('STAGE_21_2_ABORTED:', error.message);
  process.exitCode = 1;
}
