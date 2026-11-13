#!/usr/bin/env node
'use strict';
/** One-time, idempotent 19.1 integration. Preserves stage 19.0 and user changes. */
const fs = require('node:fs');
const path = require('node:path');
const frontend = path.resolve(__dirname, '..');
const paths = [
  path.join(frontend, 'src/app/features/ai-lab/agent-planner/agent-planner.ts'),
  path.join(frontend, 'src/app/features/ai-lab/agent-planner/agent-planner.html'),
  path.join(frontend, 'public/i18n/pl.json'),
  path.join(frontend, 'public/i18n/en.json'),
  path.join(frontend, 'scripts/dev-stack.cjs'),
];
const translations = {
  "pl": {
    "lab.fileWrite.title": "19.1 — Kontrolowany zapis pliku",
    "lab.fileWrite.description": "Wymaga pełnej zgodności oryginału z plikiem na dysku. Nie zapisuje fragmentów. Nie uruchamia kodu.",
    "lab.fileWrite.disabled": "Zapis plików wyłączony w Spring Boot. Funkcja wymaga jawnego włączenia i katalogu projektu.",
    "lab.fileWrite.scope": "Dozwolony katalog",
    "lab.fileWrite.target": "Docelowy plik",
    "lab.fileWrite.consent": "Przejrzałem cały diff i chcę przygotować tę jedną zmianę do zapisu.",
    "lab.fileWrite.prepare": "Sprawdź plik i przygotuj zapis",
    "lab.fileWrite.confirmDescription": "Spring Boot potwierdził zgodność pliku. Drugie kliknięcie zapisze zmianę i utworzy kopię zapasową.",
    "lab.fileWrite.apply": "Potwierdzam — zapisz zmianę",
    "lab.fileWrite.rollbackConsent": "Chcę przywrócić poprzednią zawartość wskazanego pliku.",
    "lab.fileWrite.rollback": "Cofnij zmianę",
    "lab.fileWrite.history": "Historia zapisów",
    "lab.fileWrite.error": "Operacja nie została potwierdzona. Sprawdź historię przed ponowieniem",
    "lab.fileWrite.warning": "To nie jest test bezpieczeństwa ani kompilacja. Zmiany są ograniczone do jednego istniejącego pliku. Cofnięcie odmówi, gdy plik zmieni się ponownie.",
    "lab.fileWrite.refresh": "Sprawdź stan i historię zapisów",
    "lab.fileWrite.expires": "Zezwolenie ważne przez",
    "lab.fileWrite.changed": "Plik na dysku zmienił się od przygotowania podglądu. Odczytaj go ponownie — nic nie nadpisano.",
    "lab.fileWrite.expired": "Zezwolenie wygasło. Sprawdź aktualny plik i ponownie przygotuj zapis."
  },
  "en": {
    "lab.fileWrite.title": "19.1 — Controlled file update",
    "lab.fileWrite.description": "Requires the entire original file to match its on-disk contents. Does not overwrite excerpts or execute code.",
    "lab.fileWrite.disabled": "Spring Boot file writes are disabled. Explicit workspace and enablement are required.",
    "lab.fileWrite.scope": "Allowed workspace",
    "lab.fileWrite.target": "Target file",
    "lab.fileWrite.consent": "I reviewed the entire diff and want to prepare this one change for saving.",
    "lab.fileWrite.prepare": "Verify file and prepare update",
    "lab.fileWrite.confirmDescription": "Spring Boot verified the file. A separate click will write the update and create a backup.",
    "lab.fileWrite.apply": "Confirm — save this change",
    "lab.fileWrite.rollbackConsent": "I want to restore the previous contents of the selected file.",
    "lab.fileWrite.rollback": "Roll back",
    "lab.fileWrite.history": "Change history",
    "lab.fileWrite.error": "Operation not confirmed. Check history before retrying",
    "lab.fileWrite.warning": "This is not a security audit or compilation. Only one existing file can be updated. Rollback will refuse if the file has changed again.",
    "lab.fileWrite.refresh": "Check status and change history",
    "lab.fileWrite.expires": "Authorization expires in",
    "lab.fileWrite.changed": "The disk file has changed since preview. Read it again; nothing was overwritten.",
    "lab.fileWrite.expired": "Authorization expired. Verify the current file and prepare the change again."
  }
};
function replaceOnce(value, anchor, replacement, label) {
  const index = value.indexOf(anchor);
  if (index < 0 || value.indexOf(anchor, index + anchor.length) !== -1) {
    throw new Error(`Ambiguous/missing ${label}; no files were changed`);
  }
  return value.slice(0, index) + replacement + value.slice(index + anchor.length);
}
function prepare() {
  const [tsFile, htmlFile, plFile, enFile, devFile] = paths;
  let ts = fs.readFileSync(tsFile, 'utf8');
  let html = fs.readFileSync(htmlFile, 'utf8');
  if (!ts.includes('import { AgentFileWrite }')) {
    const anchor = "import { AgentSandbox } from '../agent-sandbox/agent-sandbox'; // JARVIS_STAGE16_4_SANDBOX";
    ts = replaceOnce(ts, anchor, anchor + "\nimport { AgentFileWrite } from '../agent-file-write/agent-file-write';", 'AgentSandbox import');
  }
  if (!/imports:\s*\[[^\]]*\bAgentFileWrite\b/.test(ts)) {
    ts = replaceOnce(ts, 'imports: [AgentSandbox,', 'imports: [AgentSandbox, AgentFileWrite,', 'standalone imports');
  }
  if (!html.includes('<app-agent-file-write [preview]="patch" />')) {
    const anchor = '<app-agent-sandbox [preview]="patch" />';
    html = replaceOnce(html, anchor, anchor + '\n        <app-agent-file-write [preview]="patch" />', 'patch preview slot');
  }
  let dev = fs.readFileSync(devFile, 'utf8');
  if (!dev.includes("AGENT_(?:WORKSPACE_ROOT|FILE_WRITES_ENABLED)")) {
    dev = replaceOnce(dev,
      "JARVIS_DB_(?:HOST|PORT|NAME|USER|PASSWORD)",
      "JARVIS_(?:DB_(?:HOST|PORT|NAME|USER|PASSWORD)|AGENT_(?:WORKSPACE_ROOT|FILE_WRITES_ENABLED))",
      'local environment parser');
    dev = replaceOnce(dev,
      "key.startsWith('JARVIS_DB_')",
      "(key.startsWith('JARVIS_DB_') || key.startsWith('JARVIS_AGENT_'))",
      'environment overrides');
  }
  const outputs = new Map([[tsFile, ts], [htmlFile, html], [devFile, dev]]);
  for (const [file, lang] of [[plFile, 'pl'], [enFile, 'en']]) {
    const content = fs.readFileSync(file, 'utf8');
    const parsed = JSON.parse(content);
    const newline = content.includes('\r\n') ? '\r\n' : '\n';
    const missing = Object.entries(translations[lang]).filter(([k, v]) => {
      if (Object.hasOwn(parsed, k) && parsed[k] !== v) {
        throw new Error(`Key ${k} already exists with different text`);
      }
      return !Object.hasOwn(parsed, k);
    });
    if (!missing.length) { outputs.set(file, content); continue; }
    const end = content.lastIndexOf('}');
    if (end < 0) throw new Error('Invalid i18n JSON');
    const prefix = content.slice(0, end).trimEnd();
    const inner = prefix.endsWith('{') ? '' : ',';
    const additional = missing.map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(',' + newline);
    const out = prefix + inner + newline + additional + newline + content.slice(end);
    JSON.parse(out);
    outputs.set(file, out);
  }
  const pl = JSON.parse(outputs.get(plFile));
  const en = JSON.parse(outputs.get(enFile));
  if (JSON.stringify(Object.keys(pl).sort()) !== JSON.stringify(Object.keys(en).sort())) {
    throw new Error('PL/EN key set differs; refusing to modify files');
  }
  return outputs;
}
try {
  const outputs = prepare(); // Validate all paths/content before ANY write.
  let count = 0;
  for (const [file, value] of outputs) {
    const before = fs.readFileSync(file, 'utf8');
    if (before === value) continue;
    const backup = file + '.backup-before-stage-19-1';
    if (!fs.existsSync(backup)) fs.copyFileSync(file, backup);
    fs.writeFileSync(file, value, 'utf8');
    count++;
  }
  console.log(`STAGE_19_1_OK: updated ${count} existing files; PL/EN compatible. Previous versions backed up.`);
} catch (error) {
  console.error('STAGE_19_1_ABORTED: ' + error.message);
  process.exitCode = 1;
}
