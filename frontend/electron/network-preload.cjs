"use strict";
// Development Electron only: expose a single limited, read-only network diagnostic.
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('jarvisDesktop', Object.freeze({
  checkInternet: () => ipcRenderer.invoke('jarvis:internet:check'),
}));
