import { Injectable } from '@angular/core';
import { browserApi } from './browser-api';
import type { ProjectKind, ProjectCheckResult } from './agent-project-check-api';

export type ProjectCheckHistoryStatus = ProjectCheckResult['status'];

/** Only server-generated metadata; source code and execution logs are never in history. */
export interface ProjectCheckHistoryRun {
  readonly checkId: string;
  readonly kind: ProjectKind;
  readonly status: ProjectCheckHistoryStatus;
  readonly relativePath: string;
  readonly proposedSha256: string;
  readonly snapshotSha256: string;
  readonly image: string;
  readonly fileCount: number;
  readonly elapsedMs: number;
  readonly createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class AgentProjectCheckHistoryApiService {
  list(limit = 20): Promise<readonly ProjectCheckHistoryRun[]> {
    const count = Math.max(1, Math.min(50, Math.trunc(limit)));
    return browserApi('GET', `/api/agent/project-checks/history?limit=${count}`);
  }
}
