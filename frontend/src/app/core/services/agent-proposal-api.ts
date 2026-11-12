import { browserApi } from './browser-api';
import { Injectable } from '@angular/core';

export type AgentProposalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export interface AgentProposal {
  readonly id: string;
  readonly task: string;
  readonly plan: string;
  readonly status: AgentProposalStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** Explicitly reviewed short code excerpts; only passed to local Spring Boot/Qwen. */
export interface AgentCodeSource {
  readonly relativePath: string;
  readonly content: string;
}

export type AgentReviewWarning = 'LARGE_CHANGE' | 'PROCESS_EXECUTION' | 'DYNAMIC_CODE' | 'POSSIBLE_SECRET';
export interface AgentReviewSummary {
  readonly beforeLines: number;
  readonly afterLines: number;
  readonly removedLines: number;
  readonly addedLines: number;
  readonly warnings: readonly AgentReviewWarning[];
}

/** Preview generated on the backend from ONE explicitly approved excerpt. Never saved or applied. */
export interface AgentPatchPreview {
  readonly relativePath: string;
  readonly original: string;
  readonly proposed: string;
  readonly diff: string;
  readonly notice: string;
  /** Added in 19.0; optional for compatibility with older preview API/mocks. */
  readonly review?: AgentReviewSummary;
}

export type AgentProposalRequest =
  | { operation: 'list' }
  | { operation: 'generate'; task: string; sources?: readonly AgentCodeSource[] }
  | { operation: 'patch-preview'; task: string; source: AgentCodeSource }
  | { operation: 'decide'; id: string; decision: 'APPROVED' | 'REJECTED' }
  | { operation: 'revise'; id: string; feedback: string };

type Result = { ok: true; status: number; data: unknown } | { ok: false; status: number; error: string };
type AgentBridge = { agentProposalApi?: (request: AgentProposalRequest) => Promise<Result> };

@Injectable({ providedIn: 'root' })
export class AgentProposalApiService {
  private bridge(): AgentBridge | undefined {
    return (window as unknown as { jarvisDesktop?: AgentBridge }).jarvisDesktop;
  }

  get available(): boolean { return true; }

  private async request<T>(message: AgentProposalRequest): Promise<T> {
    const call = this.bridge()?.agentProposalApi;
    if (call) {
      let result: Result;
      try { result = await call(message); }
      catch { throw new Error('Połączenie z lokalnym backendem nie powiodło się.'); }
      if (!result.ok) throw new Error(`Agent: ${result.error}`);
      return result.data as T;
    }
    const base = '/api/agent';
    switch (message.operation) {
      case 'list': return browserApi<T>('GET', `${base}/proposals`);
      case 'generate': return browserApi<T>('POST', `${base}/proposals`, {
        task: message.task, sources: message.sources ?? [],
      });
      case 'patch-preview': return browserApi<T>('POST', `${base}/patch-preview`, {
        task: message.task, source: message.source,
      });
      case 'decide': return browserApi<T>('POST', `${base}/proposals/${encodeURIComponent(message.id)}/decision`, {
        decision: message.decision,
      });
      case 'revise': return browserApi<T>('POST', `${base}/proposals/${encodeURIComponent(message.id)}/revise`, {
        feedback: message.feedback,
      });
    }
  }

  list(): Promise<AgentProposal[]> { return this.request({ operation: 'list' }); }
  generate(task: string, sources?: readonly AgentCodeSource[]): Promise<AgentProposal> {
    return this.request({ operation: 'generate', task, ...(sources?.length ? { sources } : {}) });
  }
  previewPatch(task: string, source: AgentCodeSource): Promise<AgentPatchPreview> {
    return this.request({ operation: 'patch-preview', task, source });
  }
  approve(id: string): Promise<AgentProposal> {
    return this.request({ operation: 'decide', id, decision: 'APPROVED' });
  }
  reject(id: string): Promise<AgentProposal> {
    return this.request({ operation: 'decide', id, decision: 'REJECTED' });
  }
  revise(id: string, feedback: string): Promise<AgentProposal> {
    return this.request({ operation: 'revise', id, feedback });
  }
}
