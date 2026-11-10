import { Injectable } from '@angular/core';
import { AgentPatchPreview } from './agent-proposal-api';

export type ProjectTestStatus = 'passed' | 'failed' | 'inconclusive' | 'unavailable';
export interface ProjectTestReport {
  readonly status: ProjectTestStatus;
  readonly scope: 'frontend' | 'backend';
  readonly message: string;
  readonly diagnostics?: string;
  readonly copiedFiles?: number;
  readonly grantId?: string; // JARVIS_16_6_NATIVE_APPLY — short-lived native authorization
}
export interface ProjectTestRequest {
  operation: 'test';
  relativePath: string;
  original: string;
  proposed: string;
}
type DesktopBridge = {
  agentProjectTest?: (request: ProjectTestRequest) => Promise<ProjectTestReport>;
};

@Injectable({ providedIn: 'root' })
export class AgentProjectTestApiService {
  private bridge(): DesktopBridge | undefined {
    return (window as unknown as { jarvisDesktop?: DesktopBridge }).jarvisDesktop;
  }
  get available(): boolean { return typeof this.bridge()?.agentProjectTest === 'function'; }
  run(patch: AgentPatchPreview): Promise<ProjectTestReport> {
    const invoke = this.bridge()?.agentProjectTest;
    if (!invoke) return Promise.reject(new Error('Pełne testy wymagają aplikacji Electron.'));
    return invoke({ operation: 'test', relativePath: patch.relativePath,
      original: patch.original, proposed: patch.proposed });
  }
}
