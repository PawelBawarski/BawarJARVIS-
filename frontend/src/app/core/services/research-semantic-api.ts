import { Injectable } from '@angular/core';
import { browserApi } from './browser-api';

export interface SemanticStatus {
  readonly configured: boolean;
  readonly model: string;
  readonly knowledgeCount: number;
  readonly indexedCount: number;
  readonly batchLimit: number;
  readonly scanLimit: number;
}

export interface SemanticHit {
  readonly id: string;
  readonly title: string;
  readonly url: string;
  readonly excerpt: string;
  readonly similarity: number;
  readonly method: 'semantic' | 'text';
}

export interface SemanticIndexResult {
  readonly processed: number;
  readonly indexedCount: number;
  readonly knowledgeCount: number;
}

@Injectable({ providedIn: 'root' })
export class ResearchSemanticApi {
  private readonly base = '/api/research/semantic';
  status(): Promise<SemanticStatus> { return browserApi<SemanticStatus>('GET', `${this.base}/status`); }
  search(text: string): Promise<SemanticHit[]> {
    return browserApi<SemanticHit[]>('GET', `${this.base}/search?q=${encodeURIComponent(text)}`);
  }
  indexNext(): Promise<SemanticIndexResult> {
    return browserApi<SemanticIndexResult>('POST', `${this.base}/index-next`);
  }
}
