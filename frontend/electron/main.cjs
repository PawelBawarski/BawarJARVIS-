'use strict';
/** Developer-only Electron shell. No preload, IPC, updater, DB or packaging. */
const { app, BrowserWindow, session, ipcMain, net } = require('electron');
const path = require('node:path');
const { DEV_URL, isTrustedDevUrl } = require('./security.cjs');

async function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, 'network-preload.cjs'),
      webSecurity: true,
    },
  });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  for (const eventName of ['will-navigate', 'will-redirect']) {
    win.webContents.on(eventName, (event, url) => {
      if (!isTrustedDevUrl(url)) event.preventDefault();
    });
  }
  win.once('ready-to-show', () => win.show());
  await win.loadURL(DEV_URL);
}
app.whenReady().then(async () => {
  ipcMain.handle('jarvis:internet:check', async (event) => {
    // The diagnostic is callable only by JARVIS's own trusted dev page.
    if (!isTrustedDevUrl(event.sender.getURL())) return { state: 'unverified' };
    try {
      const response = await net.fetch('https://www.gstatic.com/generate_204', {
        signal: AbortSignal.timeout(6000), cache: 'no-store',
      });
      return { state: response.status === 204 ? 'online' : 'unverified' };
    } catch {
      // A blocked diagnostic endpoint is not proof that the Internet is down.
      return { state: 'unverified' };
    }
  });
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  await createWindow();
}).catch(error => { console.error('JARVIS_DEV_ELECTRON_FAILED', error.message); app.quit(); });
app.on('window-all-closed', () => app.quit());
