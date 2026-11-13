import { Injectable } from '@angular/core';
import { browserApi } from './browser-api';
import { AgentPatchPreview } from './agent-proposal-api';

export interface FileWriteStatus { readonly enabled: boolean; readonly scope: string; readonly notice: string; }
export interface FileWritePreparation {
  readonly ticket: string; readonly relativePath: string;
  readonly beforeSha256: string; readonly afterSha256: string;
  readonly expiresInSeconds: number; readonly notice: string;
}
export interface FileWriteResult {
  readonly status: 'applied' | 'rolled_back'; readonly deploymentId: string;
  readonly relativePath: string; readonly message: string;
}
export interface FileWriteDeployment {
  readonly deploymentId: string; readonly relativePath: string;
  readonly status: 'applied' | 'rolled_back' | 'conflicted'; readonly createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class AgentFileWriteApiService {
  private readonly base = '/api/agent/file-changes';
  status(): Promise<FileWriteStatus> { return browserApi('GET', `${this.base}/status`); }
  prepare(preview: AgentPatchPreview): Promise<FileWritePreparation> {
    // No retry: this issues a short-lived, one-time approval ticket.
    return browserApi('POST', `${this.base}/prepare`, {
      relativePath: preview.relativePath, original: preview.original, proposed: preview.proposed,
    });
  }
  apply(ticket: string): Promise<FileWriteResult> {
    return browserApi('POST', `${this.base}/apply`, { ticket, confirmation: 'ZAPISZ' });
  }
  rollback(deploymentId: string): Promise<FileWriteResult> {
    return browserApi('POST', `${this.base}/rollback`, { deploymentId, confirmation: 'COFNIJ' });
  }
  history(): Promise<FileWriteDeployment[]> { return browserApi('GET', `${this.base}/history`); }
}
