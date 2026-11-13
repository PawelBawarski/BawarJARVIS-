import { Injectable } from '@angular/core';
import { browserApi } from './browser-api';
import { AgentPatchPreview } from './agent-proposal-api';

export interface IsolatedCheckStatus {
  readonly enabled: boolean;
  readonly notice: string;
}
export interface IsolatedCheckResult {
  readonly checkId: string;
  readonly relativePath: string;
  readonly proposedSha256: string;
  readonly kind: 'TS_SYNTAX' | 'JS_SYNTAX' | 'JAVA_COMPILE' | 'JS_TEST';
  readonly status: 'passed' | 'failed' | 'timeout' | 'unavailable';
  readonly summary: string;
  readonly output: string;
  readonly elapsedMs: number;
}

@Injectable({ providedIn: 'root' })
export class AgentIsolatedCheckApiService {
  private readonly base = '/api/agent/isolated-checks';
  status(): Promise<IsolatedCheckStatus> { return browserApi('GET', `${this.base}/status`); }
  /** POST is intentionally never retried; the container may still be running. */
  run(preview: AgentPatchPreview): Promise<IsolatedCheckResult> {
    return browserApi('POST', `${this.base}/run`, {
      relativePath: preview.relativePath,
      original: preview.original,
      proposed: preview.proposed,
    });
  }
}
