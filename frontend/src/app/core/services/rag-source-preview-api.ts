import { Injectable } from '@angular/core';
import { browserApi } from './browser-api';

export interface RagSource {
  readonly id: string;
  readonly title: string;
  readonly excerpt: string;
  readonly method: 'semantic' | 'text';
  readonly externalUrl: string | null;
  readonly local: boolean;
}

export interface RagPreview {
  readonly query: string;
  readonly sources: readonly RagSource[];
  /** Always false in 20.4: these are live matches, not recorded response citations. */
  readonly snapshotOfAnswer: false;
}

@Injectable({ providedIn: 'root' })
export class RagSourcePreviewApi {
  preview(question: string): Promise<RagPreview> {
    // POST keeps the user's question out of URLs and ordinary access logs.
    return browserApi<RagPreview>('POST', '/api/research/context/preview', { question });
  }
}
