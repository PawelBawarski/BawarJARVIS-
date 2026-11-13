import { Injectable } from '@angular/core';
import { browserApi } from './browser-api';
import type { AgentPatchPreview } from './agent-proposal-api';

export type ProjectKind = 'angular' | 'spring';
export interface ProjectSource {
  readonly path: string;
  readonly content: string;
}
export interface ProjectCheckResult {
  readonly checkId: string;
  readonly kind: ProjectKind;
  readonly status: 'passed' | 'failed' | 'timeout' | 'unavailable';
  readonly summary: string;
  readonly relativePath: string;
  readonly proposedSha256: string;
  readonly snapshotSha256: string;
  readonly image: string;
  readonly fileCount: number;
  readonly output: string;
  readonly elapsedMs: number;
}

@Injectable({ providedIn: 'root' })
export class AgentProjectCheckApiService {
  /** Test execution is side-effectful, therefore POST must never be automatically retried. */
  run(projectKind: ProjectKind, preview: AgentPatchPreview, files: readonly ProjectSource[]): Promise<ProjectCheckResult> {
    return browserApi('POST', '/api/agent/project-checks/run', {
      projectKind,
      relativePath: preview.relativePath,
      original: preview.original,
      proposed: preview.proposed,
      files,
    });
  }
}
