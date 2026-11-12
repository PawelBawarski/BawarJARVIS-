'use strict';
/** Developer-only Electron shell. No preload, IPC, updater, DB or packaging. */
const { app, BrowserWindow, session } = require('electron');
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
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  await createWindow();
}).catch(error => { console.error('JARVIS_DEV_ELECTRON_FAILED', error.message); app.quit(); });
app.on('window-all-closed', () => app.quit());
