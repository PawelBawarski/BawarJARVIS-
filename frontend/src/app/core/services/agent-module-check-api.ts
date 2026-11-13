import { Injectable } from '@angular/core';
import { browserApi } from './browser-api';
import { AgentPatchPreview } from './agent-proposal-api';

export interface ModuleRelatedFile {
  readonly name: string;
  readonly content: string;
}

export interface ModuleCheckResult {
  readonly checkId: string;
  readonly relativePath: string;
  readonly proposedSha256: string;
  readonly snapshotSha256: string;
  readonly kind: 'JAVA_MODULE' | 'TS_SYNTAX_MODULE' | 'JS_SYNTAX_MODULE' | 'JS_TEST_MODULE';
  readonly status: 'passed' | 'failed' | 'timeout' | 'unavailable';
  readonly summary: string;
  readonly fileCount: number;
  readonly output: string;
  readonly elapsedMs: number;
}

@Injectable({ providedIn: 'root' })
export class AgentModuleCheckApiService {
  /** Never retry POST: Docker may still be running after a lost HTTP response. */
  run(preview: AgentPatchPreview, relatedFiles: readonly ModuleRelatedFile[], testFile: string): Promise<ModuleCheckResult> {
    return browserApi('POST', '/api/agent/module-checks/run', {
      relativePath: preview.relativePath,
      original: preview.original,
      proposed: preview.proposed,
      relatedFiles,
      testFile,
    });
  }
}
