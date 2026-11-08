const { contextBridge, ipcRenderer } = require("electron");

// Narrow API: no raw ipcRenderer, no arbitrary URL, no authentication token.
contextBridge.exposeInMainWorld("jarvisDesktop", {
  checkPrivateHealth: () => ipcRenderer.invoke("jarvis:private-health"),
});
