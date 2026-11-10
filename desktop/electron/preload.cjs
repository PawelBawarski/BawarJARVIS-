const { contextBridge, ipcRenderer } = require('electron');

// Only pre-approved methods; no raw IPC, no arbitrary URL, no session token.
contextBridge.exposeInMainWorld('jarvisDesktop', {
  checkPrivateHealth: () => ipcRenderer.invoke('jarvis:private-health'),
  chatApi: (request) => ipcRenderer.invoke('jarvis:chat-api', request),
  // JARVIS_STAGE16_PLANNER — only a fixed operation bridge (no raw IPC).
  agentProposalApi: (request) => ipcRenderer.invoke('jarvis:agent-proposal-api', request),
  // JARVIS_15_RESEARCH_MEMORY
  researchApi: (request) => ipcRenderer.invoke('jarvis:research-api', request),
  openResearchSource: (url) => ipcRenderer.invoke('jarvis:research-open-source', url),
  aiLabApi: (request) => ipcRenderer.invoke('jarvis:lab-api', request),
  workspaceApi: (request) => ipcRenderer.invoke('jarvis:workspace', request),
  checkInternet: () => ipcRenderer.invoke('jarvis:check-internet'),
  openReleasesPage: () => ipcRenderer.invoke('jarvis:open-releases'),
  openProjectPage: () => ipcRenderer.invoke('jarvis:open-project'),
});
