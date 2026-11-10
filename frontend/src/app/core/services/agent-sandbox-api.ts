import { Injectable } from '@angular/core';
import { AgentPatchPreview } from './agent-proposal-api';

export type SandboxStatus = 'passed' | 'failed' | 'inconclusive' | 'unavailable';
export interface SandboxReport {
  readonly status: SandboxStatus;
  readonly language: string;
  readonly message: string;
  readonly diagnostics?: string;
}

type Request = {
  operation: 'check'; relativePath: string; original: string; proposed: string;
};
type DesktopBridge = { sandboxCheck?: (request: Request) => Promise<SandboxReport> };

@Injectable({ providedIn: 'root' })
export class AgentSandboxApiService {
  private bridge(): DesktopBridge | undefined {
    return (window as unknown as { jarvisDesktop?: DesktopBridge }).jarvisDesktop;
  }
  get available(): boolean { return typeof this.bridge()?.sandboxCheck === 'function'; }
  async check(preview: AgentPatchPreview): Promise<SandboxReport> {
    const check = this.bridge()?.sandboxCheck;
    if (!check) throw new Error('Izolowany test wymaga aplikacji Electron.');
    return check({ operation: 'check', relativePath: preview.relativePath,
      original: preview.original, proposed: preview.proposed });
  }
}
