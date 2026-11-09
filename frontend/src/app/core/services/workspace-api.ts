import { Injectable } from '@angular/core';

/** Only these five operations are exposed by Electron. There is no write, delete or execute. */
export type WorkspaceRequest =
  | { operation: 'status' | 'choose' | 'clear' }
  | { operation: 'list'; relativePath: string }
  | { operation: 'read'; relativePath: string };

export type WorkspaceResult =
  | { ok: true; data: unknown }
  | { ok: false; error: string };

export interface WorkspaceStatus {
  readonly selected: string | null;
  readonly readOnly: true;
  readonly writeEnabled: false;
}
export interface WorkspaceEntry {
  readonly name: string;
  readonly kind: 'directory' | 'file';
  readonly relativePath: string;
}
export interface WorkspaceListing {
  readonly relativePath: string;
  readonly entries: readonly WorkspaceEntry[];
}
export interface WorkspacePreview {
  readonly relativePath: string;
  readonly content: string;
  readonly size: number;
}

@Injectable({ providedIn: 'root' })
export class WorkspaceApiService {
  get available(): boolean { return typeof window.jarvisDesktop?.workspaceApi === 'function'; }

  private async request<T>(request: WorkspaceRequest): Promise<T> {
    const call = window.jarvisDesktop?.workspaceApi;
    if (!call) throw new Error('WORKSPACE_REQUIRES_ELECTRON');
    const result: WorkspaceResult = await call(request);
    if (!result.ok) throw new Error(result.error);
    return result.data as T;
  }
  status(): Promise<WorkspaceStatus> { return this.request({ operation: 'status' }); }
  choose(): Promise<WorkspaceStatus> { return this.request({ operation: 'choose' }); }
  clear(): Promise<WorkspaceStatus> { return this.request({ operation: 'clear' }); }
  list(relativePath = ''): Promise<WorkspaceListing> { return this.request({ operation: 'list', relativePath }); }
  read(relativePath: string): Promise<WorkspacePreview> { return this.request({ operation: 'read', relativePath }); }
}
