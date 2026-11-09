export {};

declare global {
  interface Window {
    jarvisDesktop?: {
      checkPrivateHealth(): Promise<{ status: 'authenticated' | 'unavailable' }>;
      checkInternet?(): Promise<{ state: 'online' | 'offline' | 'unverified' }>;
      openReleasesPage?(): Promise<boolean>;
      openProjectPage?(): Promise<boolean>;
      chatApi?(request: import('../services/chat-api').ChatApiRequest): Promise<import('../services/chat-api').ChatApiResult>;
      aiLabApi?(request: import('../services/ai-lab-api').LabApiRequest): Promise<import('../services/ai-lab-api').LabApiResult>;
      workspaceApi?(request: import('../services/workspace-api').WorkspaceRequest): Promise<import('../services/workspace-api').WorkspaceResult>;
    };
  }
}
