import { Injectable } from '@angular/core';

export type DeploymentResult = {
  readonly status: 'applied' | 'rolled_back' | 'cancelled';
  readonly relativePath?: string;
  readonly deploymentId?: string;
  readonly message: string;
};
export interface DeploymentHistory { readonly deploymentId: string; readonly relativePath: string; readonly createdAt: string; }
export interface DeploymentHistoryResult { readonly status: 'ok'; readonly deployments: readonly DeploymentHistory[]; }
type Request =
  | { operation: 'apply'; grantId: string }
  | { operation: 'rollback'; deploymentId: string }
  | { operation: 'history' };
type Bridge = { agentWorkspaceApply?: (request: Request) => Promise<DeploymentResult | DeploymentHistoryResult> };

@Injectable({ providedIn: 'root' })
export class AgentWorkspaceApplyApiService {
  private get bridge(): Bridge | undefined {
    return (window as unknown as { jarvisDesktop?: Bridge }).jarvisDesktop;
  }
  get available(): boolean { return typeof this.bridge?.agentWorkspaceApply === 'function'; }
  apply(grantId: string): Promise<DeploymentResult> {
    const call = this.bridge?.agentWorkspaceApply;
    if (!call) return Promise.reject(new Error('Zapis kodu wymaga aplikacji Electron.'));
    return call({ operation: 'apply', grantId }) as Promise<DeploymentResult>;
  }
  history(): Promise<DeploymentHistoryResult> {
    const call = this.bridge?.agentWorkspaceApply;
    if (!call) return Promise.reject(new Error('Historia wdrożeń wymaga aplikacji Electron.'));
    return call({ operation: 'history' }) as Promise<DeploymentHistoryResult>;
  }
  rollback(deploymentId: string): Promise<DeploymentResult> {
    const call = this.bridge?.agentWorkspaceApply;
    if (!call) return Promise.reject(new Error('Cofnięcie wymaga aplikacji Electron.'));
    return call({ operation: 'rollback', deploymentId }) as Promise<DeploymentResult>;
  }
}
