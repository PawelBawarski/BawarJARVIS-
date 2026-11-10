const { contextBridge, ipcRenderer } = require('electron');

// Only pre-approved methods; no raw IPC, no arbitrary URL, no session token.
contextBridge.exposeInMainWorld('jarvisDesktop', {
  checkPrivateHealth: () => ipcRenderer.invoke('jarvis:private-health'),
  chatApi: (request) => ipcRenderer.invoke('jarvis:chat-api', request),
  // JARVIS_STAGE16_PLANNER — only a fixed operation bridge (no raw IPC).
  agentProposalApi: (request) => ipcRenderer.invoke('jarvis:agent-proposal-api', request),
  // JARVIS_STAGE16_4_SANDBOX — fixed syntax-check-only Electron bridge.
  sandboxCheck: (request) => ipcRenderer.invoke('jarvis:agent-sandbox-check', request),
  // JARVIS_STAGE16_5_PROJECT_TEST — single manual Docker test request.
  agentProjectTest: (request) => ipcRenderer.invoke('jarvis:agent-project-test', request),
  // JARVIS_16_6_NATIVE_APPLY — fixed native apply/rollback, no file path in the request.
  agentWorkspaceApply: (request) => ipcRenderer.invoke('jarvis:agent-workspace-apply', request),
  // JARVIS_15_RESEARCH_MEMORY
  researchApi: (request) => ipcRenderer.invoke('jarvis:research-api', request),
  openResearchSource: (url) => ipcRenderer.invoke('jarvis:research-open-source', url),
  aiLabApi: (request) => ipcRenderer.invoke('jarvis:lab-api', request),
  workspaceApi: (request) => ipcRenderer.invoke('jarvis:workspace', request),
  checkInternet: () => ipcRenderer.invoke('jarvis:check-internet'),
  openReleasesPage: () => ipcRenderer.invoke('jarvis:open-releases'),
  openProjectPage: () => ipcRenderer.invoke('jarvis:open-project'),
});
