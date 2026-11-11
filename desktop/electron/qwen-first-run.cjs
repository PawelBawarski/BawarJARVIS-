'use strict';
/**
 * J.A.R.V.I.S. 17.6.2 — model provisioned by Electron MAIN, on explicit consent.
 * No renderer IPC; no arbitrary URL; pinned SHA-256 from bundled 17.4 manifest.
 * Data is outside the installer and is never silently overwritten or deleted.
 */
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { expectedModel, resolveVerifiedQwenModel, MODEL, noSymlinks } = require('./qwen-model-path.cjs');

// Official Qwen upload. This digest is independently published on the model page.
const OFFICIAL_SHA256 = 'd98cdcbd03e17ce47681435b5150e34c1417f50b5c0019dd560e4882c5745785';
const OFFICIAL_URL = 'https://huggingface.co/Qwen/Qwen3-8B-GGUF/resolve/main/Qwen3-8B-Q4_K_M.gguf';
const REDIRECT_HOSTS = new Set([
  'huggingface.co', 'cas-bridge.xethub.hf.co', 'cas-server.xethub.hf.co',
  'cas-server.xethub-eu.hf.co', 'transfer.xethub.hf.co',
  'transfer.xethub-eu.hf.co', 'us.aws.cdn.hf.co', 'us.gcp.cdn.hf.co',
  'cdn-lfs-us-1.hf.co', 'cdn-lfs-eu-1.hf.co',
]);
let activeController = null;
let pendingSetup = null;

function assertWindowsContext(resourcesPath, env, platform) {
  if (platform !== 'win32' || !path.isAbsolute(resourcesPath || '')) {
    throw new Error('Qwen 17.6.2 wymaga spakowanego Jarvisa Windows.');
  }
  if (typeof env.LOCALAPPDATA !== 'string' || !path.isAbsolute(env.LOCALAPPDATA)) {
    throw new Error('Brak zaufanego katalogu LOCALAPPDATA do przechowywania Qwen.');
  }
  return path.join(env.LOCALAPPDATA, 'J.A.R.V.I.S.', 'models', MODEL);
}

function assertNoLinksExisting(p) {
  let current = path.parse(path.resolve(p)).root;
  for (const segment of path.relative(current, path.resolve(p)).split(path.sep)) {
    if (!segment) continue;
    current = path.join(current, segment);
    if (fs.existsSync(current) && fs.lstatSync(current).isSymbolicLink()) {
      throw new Error('Qwen: niedozwolone dowiązanie symboliczne w ścieżce modelu.');
    }
  }
}

function assertAllowedUrl(value) {
  const u = new URL(value);
  if (u.protocol !== 'https:' || u.username || u.password || u.port || !REDIRECT_HOSTS.has(u.hostname)) {
    throw new Error('Qwen: niedozwolone przekierowanie pobierania modelu.');
  }
  return u;
}

async function openTrustedStream(url, { fetchImpl, signal }) {
  let current = assertAllowedUrl(url);
  for (let n = 0; n <= 8; n++) {
    const response = await fetchImpl(current.toString(), {
      method: 'GET', redirect: 'manual', credentials: 'omit', cache: 'no-store', signal,
      headers: { 'Accept': 'application/octet-stream' },
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location) throw new Error('Qwen: przekierowanie bez adresu.');
      try { await response.body?.cancel?.(); } catch { /* release redirect body */ }
      current = assertAllowedUrl(new URL(location, current).toString());
      continue;
    }
    if (response.status !== 200 || !response.body) {
      throw new Error('Qwen: nie można pobrać modelu (HTTP ' + response.status + ').');
    }
    return response;
  }
  throw new Error('Qwen: przekroczono limit przekierowań HTTPS.');
}

function ensureDestination(destination) {
  const folder = path.dirname(destination);
  assertNoLinksExisting(folder);
  fs.mkdirSync(folder, { recursive: true, mode: 0o700 });
  assertNoLinksExisting(destination);
  if (fs.existsSync(destination)) {
    throw new Error('Qwen: docelowy model już istnieje. Nie nadpisuję danych użytkownika.');
  }
  if (typeof fs.statfsSync === 'function') {
    const s = fs.statfsSync(folder);
    const available = Number(s.bavail) * Number(s.bsize);
    // The real expected size is enforced during streaming; this is an early disk diagnostic.
    if (Number.isFinite(available) && available < 64 * 1024 * 1024) {
      throw new Error('Qwen: zbyt mało wolnego miejsca na dysku.');
    }
  }
}

/** Streaming copy/download to a unique .partial file; verify BEFORE atomic no-clobber link. */
async function commitModel(source, destination, expected, { signal, onProgress = () => {} } = {}) {
  if (!expected || !Number.isSafeInteger(expected.size) || expected.size < 1 ||
      !/^[a-f0-9]{64}$/.test(expected.sha256)) {
    throw new Error('Qwen: nieprawidłowa, przypięta suma kontrolna.');
  }
  ensureDestination(destination);
  const folder = path.dirname(destination);
  const temp = path.join(folder, '.jarvis-qwen-' + crypto.randomBytes(16).toString('hex') + '.partial');
  const hash = crypto.createHash('sha256');
  let seen = 0;
  let lastPercent = -1;
  const prefix = Buffer.alloc(4);
  let prefixCount = 0;
  const handle = await fsp.open(temp, 'wx', 0o600);
  try {
    let stream;
    if (source.kind === 'file') {
      noSymlinks(source.file);
      if (path.resolve(source.file) === path.resolve(destination)) {
        throw new Error('Qwen: plik źródłowy jest już miejscem docelowym.');
      }
      if (fs.statSync(source.file).size !== expected.size) {
        throw new Error('Qwen: lokalny plik GGUF ma inny rozmiar niż manifest.');
      }
      stream = fs.createReadStream(source.file, { highWaterMark: 2 * 1024 * 1024 });
    } else if (source.kind === 'download') {
      if (expected.sha256 !== OFFICIAL_SHA256) {
        throw new Error('Qwen: ten wariant modelu nie ma zatwierdzonego adresu pobierania.');
      }
      const response = await openTrustedStream(OFFICIAL_URL, source);
      const length = response.headers.get('content-length');
      if (length !== null && /^\d+$/.test(length) && Number(length) > expected.size) {
        throw new Error('Qwen: serwer wysłał plik większy niż podpisany manifest.');
      }
      stream = response.body;
    } else {
      throw new Error('Qwen: nieznane źródło modelu.');
    }
    for await (const segment of stream) {
      if (signal?.aborted) throw new Error('Qwen: pobieranie anulowane.');
      const chunk = Buffer.from(segment);
      if (prefixCount < 4) {
        const n = Math.min(4 - prefixCount, chunk.length);
        chunk.copy(prefix, prefixCount, 0, n);
        prefixCount += n;
      }
      seen += chunk.length;
      if (seen > expected.size) throw new Error('Qwen: plik przekracza podpisany rozmiar.');
      hash.update(chunk);
      let offset = 0;
      while (offset < chunk.length) {
        const { bytesWritten } = await handle.write(chunk, offset, chunk.length - offset, null);
        if (!bytesWritten) throw new Error('Qwen: błąd zapisu modelu.');
        offset += bytesWritten;
      }
      const pct = Math.floor((seen / expected.size) * 100);
      if (pct !== lastPercent) {
        lastPercent = pct;
        try { onProgress(pct, seen, expected.size); } catch { /* progress must not corrupt download */ }
      }
    }
    if (signal?.aborted) throw new Error('Qwen: pobieranie anulowane.');
    if (seen !== expected.size || hash.digest('hex') !== expected.sha256) {
      throw new Error('Qwen: nieprawidłowa suma SHA-256 lub rozmiar pobranego GGUF.');
    }
    if (prefixCount !== 4 || prefix.toString('ascii') !== 'GGUF') {
      throw new Error('Qwen: plik nie jest prawidłowym GGUF.');
    }
    await handle.sync();
    await handle.close();
    assertNoLinksExisting(destination);
    // A hardlink on the same volume is an atomic create-if-absent (no overwriting a newer file).
    fs.linkSync(temp, destination);
    fs.unlinkSync(temp);
    return destination;
  } finally {
    try { await handle.close(); } catch { /* already closed */ }
    try { fs.unlinkSync(temp); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  }
}

function nativeOptions(allowDownload) {
  const electron = require('electron'); // lazy: unit tests run in plain Node
  const { dialog, BrowserWindow } = electron;
  return {
    async choose() {
      const buttons = allowDownload ? ['Pobierz Qwen (ok. 5 GB)', 'Wskaż istniejący GGUF', 'Anuluj'] :
        ['Wskaż istniejący GGUF', 'Anuluj'];
      const cancelId = buttons.length - 1;
      const result = await dialog.showMessageBox({
        type: 'question', title: 'J.A.R.V.I.S. — model Qwen',
        message: 'Jarvis potrzebuje lokalnego modelu Qwen3 8B.',
        detail: allowDownload ?
          'Możesz pobrać zweryfikowany model ze strony Qwen albo wskazać zgodny plik GGUF. Model pozostanie w profilu Windows.' :
          'Wbudowany manifest ma inną sumę kontrolną niż oficjalny model. Wskaż zgodny plik GGUF; Jarvis nie pobierze innej wersji bez weryfikacji.',
        buttons, defaultId: 0, cancelId, noLink: true,
      });
      if (result.response === cancelId) return 'cancel';
      return allowDownload && result.response === 0 ? 'download' : 'file';
    },
    async pickFile() {
      const result = await dialog.showOpenDialog({
        title: 'Wybierz zgodny model Qwen3 8B GGUF',
        properties: ['openFile'],
        filters: [{ name: 'GGUF', extensions: ['gguf'] }],
      });
      return result.canceled ? null : result.filePaths?.[0] || null;
    },
    progress(abort) {
      const win = new BrowserWindow({ width: 480, height: 165, resizable: false,
        minimizable: false, maximizable: false, autoHideMenuBar: true,
        title: 'J.A.R.V.I.S. — przygotowanie Qwen',
        webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
      });
      win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
      win.webContents.on('will-navigate', e => e.preventDefault());
      void win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(
        '<!doctype html><meta charset="utf-8"><style>body{font:15px Segoe UI,sans-serif;padding:24px;background:#15202e;color:white}</style>' +
        '<strong>Przygotowywanie modelu Qwen3 8B</strong><p>Pobieranie lub kopiowanie około 5 GB. Zamknięcie tego okna anuluje operację.</p>')); 
      let finished = false;
      win.on('closed', () => { if (!finished) abort(); });
      return {
        set(percent) { if (!win.isDestroyed()) {
          win.setTitle('J.A.R.V.I.S. — Qwen ' + percent + '%');
          win.setProgressBar(percent / 100);
        } },
        close() { finished = true; if (!win.isDestroyed()) win.close(); },
      };
    },
  };
}

async function doFirstRun(options = {}) {
  const { resourcesPath, env = process.env, platform = process.platform,
    getExpected = expectedModel, resolveExisting = resolveVerifiedQwenModel,
    fetchImpl = globalThis.fetch, uiFactory = nativeOptions } = options;
  const destination = assertWindowsContext(resourcesPath, env, platform);
  const context = { resourcesPath, env, platform };
  const expected = getExpected(resourcesPath);
  try { return resolveExisting(context); }
  catch (error) {
    // Do NOT silently replace a corrupt or wrong model. Only absence is recoverable.
    if (!String(error.message).startsWith('Brak modelu Qwen3 8B.')) throw error;
  }
  if (fs.existsSync(destination)) throw new Error('Qwen: plik już istnieje, ale nie przeszedł weryfikacji.');
  const allowDownload = expected.sha256 === OFFICIAL_SHA256;
  const ui = uiFactory(allowDownload);
  const choice = await ui.choose();
  if (choice === 'cancel') throw new Error('Anulowano przygotowanie modelu Qwen.');
  if (choice !== 'file' && choice !== 'download') throw new Error('Qwen: nieznana decyzja użytkownika.');
  if (choice === 'download' && !allowDownload) throw new Error('Qwen: pobieranie niezgodnej wersji jest niedozwolone.');
  const selected = choice === 'file' ? await ui.pickFile() : null;
  if (choice === 'file' && !selected) throw new Error('Nie wybrano modelu Qwen.');
  const controller = new AbortController();
  activeController = controller;
  const progress = ui.progress(() => controller.abort());
  try {
    await commitModel(choice === 'file' ? { kind: 'file', file: selected } :
      { kind: 'download', fetchImpl, signal: controller.signal }, destination, expected,
    { signal: controller.signal, onProgress: pct => progress.set(pct) });
    return resolveExisting(context);
  } finally {
    activeController = null;
    progress.close();
  }
}

function ensureFirstRunModel(options = {}) {
  if (!pendingSetup) pendingSetup = doFirstRun(options).finally(() => { pendingSetup = null; });
  return pendingSetup;
}
function cancelFirstRunModel() { activeController?.abort(); }

module.exports = {
  OFFICIAL_SHA256, OFFICIAL_URL, assertAllowedUrl, openTrustedStream,
  assertWindowsContext, commitModel, ensureFirstRunModel, cancelFirstRunModel,
};
