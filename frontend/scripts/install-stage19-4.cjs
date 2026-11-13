#!/usr/bin/env node
'use strict';
/** Idempotent 19.4 integration: never overwrite older panels, scripts or locale entries. */
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');

const translations = {
  pl: {
    'lab.project.title': 'Test projektu z zależnościami (Docker)',
    'lab.project.description': 'Wybierz katalog projektu Angular lub Spring Boot. J.A.R.V.I.S. prześle tylko dozwolone pliki źródłowe i manifesty, przygotuje kopię oraz nałoży propozycję Qwen wyłącznie w tej kopii.',
    'lab.project.warning': 'Uwaga: sprawdź kod i konfigurację pod kątem sekretów. Wybrane źródła trafią do lokalnego Spring Boot i izolowanego Dockera. Kontener nie dostanie dostępu do repozytorium na dysku.',
    'lab.project.disabled': 'Kontrole Dockera są wyłączone. Włącz je świadomie przez JARVIS_AGENT_TESTS_ENABLED=true.',
    'lab.project.type': 'Typ projektu',
    'lab.project.select': 'Katalog projektu zawierający package-lock.json lub pom.xml',
    'lab.project.prepare': 'Przed sprawdzeniem przygotuj obraz zależności poleceniem prepare-stage19-4.cjs angular albo spring. Przygotowanie obrazu wymaga internetu; późniejsze testy są offline.',
    'lab.project.files': 'Wybrane pliki źródłowe',
    'lab.project.mismatch': 'Kopia nie zawiera pełnej oryginalnej wersji wybranego pliku lub wymaganych manifestów. Test został zablokowany.',
    'lab.project.run': 'Uruchom testy kopii projektu',
    'lab.project.running': 'Trwa bezpieczne sprawdzanie kopii projektu…',
    'lab.project.image': 'Przygotowany obraz',
    'lab.project.time': 'Czas wykonania',
    'lab.project.error': 'Nie udało się przeprowadzić testu projektu.',
    'lab.project.disclaimer': 'PASS dotyczy wyłącznie przesłanej kopii projektu i tej wersji kodu. Nie oznacza audytu bezpieczeństwa, poprawnego działania produkcji ani zgody na zapis. Testy wymagające sieci lub usług zewnętrznych mogą nie działać.',
  },
  en: {
    'lab.project.title': 'Project tests with dependencies (Docker)',
    'lab.project.description': 'Select an Angular or Spring Boot project folder. J.A.R.V.I.S. sends only allowlisted source files and manifests, builds an isolated snapshot, and overlays the Qwen proposal in that snapshot only.',
    'lab.project.warning': 'Warning: review selected source and config files for secrets. These files are sent to local Spring Boot and isolated Docker. The container receives no host repository access.',
    'lab.project.disabled': 'Docker checks are disabled. Explicitly enable them with JARVIS_AGENT_TESTS_ENABLED=true.',
    'lab.project.type': 'Project type',
    'lab.project.select': 'Project folder containing package-lock.json or pom.xml',
    'lab.project.prepare': 'First prepare the dependency image with prepare-stage19-4.cjs angular or spring. Image preparation needs internet; subsequent checks run offline.',
    'lab.project.files': 'Selected source files',
    'lab.project.mismatch': 'The snapshot lacks the full original version of the target file or required manifests. The test is blocked.',
    'lab.project.run': 'Run isolated project tests',
    'lab.project.running': 'Checking the isolated project snapshot…',
    'lab.project.image': 'Prepared image',
    'lab.project.time': 'Execution time',
    'lab.project.error': 'Project tests could not run.',
    'lab.project.disclaimer': 'PASS applies only to this uploaded snapshot and code version. It is not a security audit, production guarantee or permission to write. Tests requiring network or external services may fail.',
  },
};
function updateTs(contents) {
  if (contents.includes('AgentProjectCheck }')) return contents;
  const anchor = "import { AgentModuleCheck } from '../agent-module-check/agent-module-check';";
  if (!contents.includes(anchor) || !contents.includes('imports: [TranslatePipe, AgentModuleCheck],'))
    throw new Error('19.3 component not found; aborting');
  return contents.replace(anchor, `${anchor}\nimport { AgentProjectCheck } from '../agent-project-check/agent-project-check';`)
    .replace('imports: [TranslatePipe, AgentModuleCheck],', 'imports: [TranslatePipe, AgentModuleCheck, AgentProjectCheck],');
}
function updateHtml(contents) {
  if (contents.includes('<app-agent-project-check')) return contents;
  const anchor = '<app-agent-module-check [preview]="preview()" [enabled]="config()?.enabled === true" />';
  if (!contents.includes(anchor)) throw new Error('19.3 module view not found; aborting');
  return contents.replace(anchor, `${anchor}\n<app-agent-project-check [preview]="preview()" [enabled]="config()?.enabled === true" />`);
}
function mergeLocale(contents, additional) {
  const data = JSON.parse(contents);
  const missing = Object.entries(additional).filter(([key]) => !Object.hasOwn(data, key));
  if (!missing.length) return contents;
  const eol = contents.includes('\r\n') ? '\r\n' : '\n';
  const end = contents.lastIndexOf('}');
  if (end < 0) throw new Error('Invalid translations');
  const prefix = contents.slice(0, end).trimEnd();
  const comma = prefix.endsWith('{') ? '' : ',';
  const next = prefix + comma + eol + missing.map(([key, value]) =>
    `  ${JSON.stringify(key)}: ${JSON.stringify(value)}`).join(',' + eol) + eol + contents.slice(end);
  JSON.parse(next);
  return next;
}
function install(dir = root) {
  const paths = {
    ts: path.join(dir, 'src/app/features/ai-lab/agent-isolated-check/agent-isolated-check.ts'),
    html: path.join(dir, 'src/app/features/ai-lab/agent-isolated-check/agent-isolated-check.html'),
    pl: path.join(dir, 'public/i18n/pl.json'),
    en: path.join(dir, 'public/i18n/en.json'),
  };
  const previous = Object.fromEntries(Object.entries(paths).map(([key, file]) => [key, fs.readFileSync(file, 'utf8')]));
  const updated = {
    ts: updateTs(previous.ts), html: updateHtml(previous.html),
    pl: mergeLocale(previous.pl, translations.pl), en: mergeLocale(previous.en, translations.en),
  };
  const pl = Object.keys(JSON.parse(updated.pl)).sort();
  const en = Object.keys(JSON.parse(updated.en)).sort();
  if (JSON.stringify(pl) !== JSON.stringify(en)) throw new Error('PL/EN dictionaries differ; aborting');
  for (const [key, filename] of Object.entries(paths)) {
    if (previous[key] === updated[key]) continue;
    const backup = filename + '.backup-before-stage-19-4';
    if (!fs.existsSync(backup)) fs.copyFileSync(filename, backup);
    fs.writeFileSync(filename, updated[key], 'utf8');
  }
  return pl.length;
}
if (require.main === module) {
  try { console.log(`STAGE_19_4_OK: project checks installed, PL/EN ${install()} keys`); }
  catch (e) { console.error('STAGE_19_4_ABORTED:', e.message); process.exitCode = 1; }
}
module.exports = { install, updateTs, updateHtml, mergeLocale, translations };
