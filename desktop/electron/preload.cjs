const { contextBridge, ipcRenderer } = require('electron');

// Only pre-approved methods; no raw IPC, no arbitrary URL, no session token.
contextBridge.exposeInMainWorld('jarvisDesktop', {
  checkPrivateHealth: () => ipcRenderer.invoke('jarvis:private-health'),
  checkInternet: () => ipcRenderer.invoke('jarvis:check-internet'),
  openReleasesPage: () => ipcRenderer.invoke('jarvis:open-releases'),
  openProjectPage: () => ipcRenderer.invoke('jarvis:open-project'),
});
