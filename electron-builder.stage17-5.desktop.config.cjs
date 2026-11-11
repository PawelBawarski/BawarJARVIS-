'use strict';
/**
 * Stage 17.5 Windows: adapter for the existing desktop/package.json project.
 * Inherits every security rule from stage17-5 and only normalizes path scopes.
 * App source: BawarJARVIS-/desktop; shared assets: BawarJARVIS-/...
 */
const fs = require('node:fs');
const path = require('node:path');
const root = __dirname;
const appRoot = path.join(root, 'desktop');
const base = require('./electron-builder.stage17-5.config.cjs');
function fail(why) { throw new Error('17.5 desktop adapter: ' + why); }
function normalizePath(p) { return String(p).replace(/\\/g, '/').replace(/^\.\//, ''); }
function inside(dir, file) {
  const rel = path.relative(dir, file);
  return rel === '' || (rel !== '..' && !rel.startsWith('..' + path.sep) && !path.isAbsolute(rel));
}
if (!fs.existsSync(path.join(appRoot, 'package.json'))) {
  fail('brak desktop/package.json');
}
const pkg = JSON.parse(fs.readFileSync(path.join(appRoot, 'package.json'), 'utf8'));
if (!pkg.name || !pkg.version || !pkg.main) {
  fail('desktop/package.json musi zawierać name, version i main');
}
if (path.isAbsolute(pkg.main) || pkg.main.split(/[\\/]/).includes('..') ||
    !fs.existsSync(path.join(appRoot, pkg.main))) {
  fail('desktop/package.json wskazuje nieistniejący/niebezpieczny punkt main');
}
// Resource FileSet.from is relative to projectDir, not to the config file.
// Convert reviewed, existing sources to absolute paths, never relax the filters.
function sourcePath(v, context) {
  if (typeof v !== 'string' || !v.trim() || /[\u0000-\u001f*?{}]/.test(v)) {
    fail('nieobsługiwane źródło w ' + context);
  }
  const posix = normalizePath(v);
  const fromRoot = path.resolve(root, posix);
  const fromApp = path.resolve(appRoot, posix);
  const choice = path.isAbsolute(v) ? path.resolve(v) :
    /^(desktop|frontend|backend|tools)\//.test(posix) ? fromRoot :
    fs.existsSync(fromApp) ? fromApp : fromRoot;
  if (!inside(root, choice)) fail('źródło zasobów poza repozytorium: ' + context);
  if (!fs.existsSync(choice)) fail('brak źródła ' + context + ': ' + v);
  // Existing paths must never point into user history or secrets.
  const rel = normalizePath(path.relative(root, choice)).toLowerCase();
  if (/(^|\/)(backend\.env|credentials\.json|state\.json|pg_wal|postgres17\/data)(\/|$)/.test(rel)) {
    fail('odmowa dołączenia prywatnych danych: ' + context);
  }
  return choice;
}
function resourceMappings(entries, label) {
  if (entries == null) return [];
  const arr = Array.isArray(entries) ? entries : [entries];
  return arr.map((e, i) => {
    if (typeof e === 'string') {
      const abs = sourcePath(e, `${label}[${i}]`);
      return {from: abs, to: path.basename(abs)};
    }
    if (!e || typeof e !== 'object' || typeof e.from !== 'string' || typeof e.to !== 'string') {
      fail('nieznany wpis ' + label + '[' + i + ']');
    }
    const target = normalizePath(e.to);
    if (path.isAbsolute(target) || target.split('/').includes('..') || !target.trim()) {
      fail('niebezpieczny katalog docelowy ' + label + '[' + i + ']');
    }
    return {...e, from: sourcePath(e.from, `${label}[${i}]`)};
  });
}
const resources = resourceMappings(base.extraResources, 'extraResources');
const uiSources = resources.filter(e => normalizePath(e.to) === 'ui');
if (uiSources.length > 1) fail('zdublowane zasoby Angular UI');
if (!uiSources.length) {
  const ui = path.join(root, 'frontend', 'dist', 'jarvis', 'browser');
  if (!fs.existsSync(path.join(ui, 'index.html'))) fail('brak zbudowanego Angular UI');
  resources.push({from: ui, to: 'ui', filter: ['**/*']});
}
function mapFiles(src) {
  const input = src == null ? ['**/*'] : Array.isArray(src) ? src : [src];
  const out = [];
  for (const entry of input) {
    if (typeof entry === 'string') {
      const excluded = entry.startsWith('!');
      const raw = excluded ? entry.slice(1) : entry;
      const normalized = normalizePath(raw);
      if (/^frontend\/dist\/jarvis\/browser\//.test(normalized)) {
        // UI is always in resources/ui, never inside asar.
        if (!excluded) continue;
      }
      if (/^(frontend|backend|tools)\//.test(normalized) && !excluded) {
        fail('nieznany wzorzec plików z katalogu głównego: ' + entry);
      }
      const mapped = normalized.startsWith('desktop/') ? normalized.slice(8) : normalized;
      out.push((excluded ? '!' : '') + mapped);
    } else if (entry && typeof entry === 'object' && typeof entry.from === 'string') {
      const posix = normalizePath(entry.from);
      const mapped = posix.startsWith('desktop/') ? posix.slice(8) : posix;
      if (mapped.startsWith('frontend/') || mapped.startsWith('backend/')) {
        fail('nietypowy FileSet w files; wymaga przeglądu');
      }
      out.push({...entry, from: mapped});
    } else {
      fail('nieznana składnia files');
    }
  }
  // Native engines are shipped only through extraResources, never duplicated in app.asar.
  out.push('!resources/**', '!ai-runtime/**', '!**/*.gguf', '!**/backend.env', '!**/credentials.json');
  if (!out.some(x => typeof x === 'string' && (x === '**/*' || x === 'electron/**/*' || x === 'electron/**'))) {
    // May be an explicit FileSet, but must include executable entry.
    if (!out.some(x => typeof x === 'object' && (x.from === '.' || x.from === 'electron')) &&
        !out.some(x => typeof x === 'string' && x.startsWith('electron/'))) {
      fail('konfiguracja files nie zawiera kodu Electron');
    }
  }
  return out;
}
const dir = {...(base.directories || {})};
if (dir.app && !['desktop', './desktop', '.'].includes(normalizePath(dir.app))) {
  fail('nieznany katalog aplikacji w directories.app');
}
dir.app = '.';
dir.output = path.join(root, 'dist', 'jarvis-17-5');
if (dir.buildResources && !path.isAbsolute(dir.buildResources)) {
  const p = sourcePath(dir.buildResources, 'directories.buildResources');
  dir.buildResources = p;
}
function iconWithRoot(p, label) {
  if (typeof p !== 'string' || !p.trim()) return p;
  return sourcePath(p, label);
}
const win = {...base.win};
if (win.icon) win.icon = iconWithRoot(win.icon, 'win.icon');
const nsis = {...base.nsis};
for (const key of ['installerIcon', 'uninstallerIcon', 'installerHeaderIcon', 'license']) {
  if (nsis[key]) nsis[key] = iconWithRoot(nsis[key], 'nsis.' + key);
}
module.exports = {
  ...base,
  directories: dir,
  files: mapFiles(base.files),
  extraResources: resources,
  extraFiles: resourceMappings(base.extraFiles, 'extraFiles'),
  win,
  nsis: { ...nsis, oneClick: true, allowToChangeInstallationDirectory: false },
};
