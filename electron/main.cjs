// Electron zarządza oknem desktopowym. Nie odpowiada za logikę AI.
const { app, BrowserWindow } = require('electron');

function createWindow() {
  const window = new BrowserWindow({
    title: 'J.A.R.V.I.S.',
    width: 1320,
    height: 840,
    minWidth: 880,
    minHeight: 600,
    backgroundColor: '#080e1d',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  });

  // Etap 01: ładujemy frontend z lokalnego serwera Angulara.
  window.loadURL('http://127.0.0.1:4200');
  window.once('ready-to-show', () => window.show());

  // Nie pozwalamy nieznanym stronom otwierać dodatkowych okien Electron.
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('http://127.0.0.1:4200/')) event.preventDefault();
  });
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
