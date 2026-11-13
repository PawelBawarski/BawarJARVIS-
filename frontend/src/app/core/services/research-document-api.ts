import { Injectable } from '@angular/core';
import { BrowserApiError, browserApi } from './browser-api';

export interface ResearchDocument {
  readonly id: string;
  readonly fileName: string;
  readonly kind: 'pdf' | 'txt' | 'md';
  readonly byteSize: number;
  readonly chunkCount: number;
  readonly createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class ResearchDocumentApi {
  private readonly endpoint = '/api/research/documents';

  list(): Promise<ResearchDocument[]> {
    return browserApi<ResearchDocument[]>('GET', this.endpoint);
  }

  remove(id: string): Promise<void> {
    return browserApi<void>('DELETE', `${this.endpoint}/${encodeURIComponent(id)}`);
  }

  async importFile(file: File): Promise<ResearchDocument> {
    const body = new FormData();
    body.append('file', file, file.name);
    let response: Response;
    try {
      response = await fetch(this.endpoint, {
        method: 'POST',
        credentials: 'same-origin',
        body, // Browser supplies the multipart boundary; do NOT set Content-Type.
      });
    } catch {
      throw new BrowserApiError(0, 'BACKEND_UNAVAILABLE');
    }
    if (!response.ok) {
      let code = `HTTP_${response.status}`;
      try {
        const payload: unknown = await response.json();
        if (payload && typeof payload === 'object' && 'code' in payload &&
          typeof payload.code === 'string' && /^[A-Z0-9_]{3,80}$/.test(payload.code)) {
          code = payload.code;
        }
      } catch { /* Preserve the HTTP status. */ }
      throw new BrowserApiError(response.status, code);
    }
    return response.json() as Promise<ResearchDocument>;
  }
}
