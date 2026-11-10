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

export type AgentProposalRequest =
  | { operation: 'list' }
  | { operation: 'generate'; task: string; sources?: readonly AgentCodeSource[] }
  | { operation: 'decide'; id: string; decision: 'APPROVED' | 'REJECTED' }
  | { operation: 'revise'; id: string; feedback: string };

type Result = { ok: true; status: number; data: unknown } | { ok: false; status: number; error: string };
type AgentBridge = { agentProposalApi?: (request: AgentProposalRequest) => Promise<Result> };

@Injectable({ providedIn: 'root' })
export class AgentProposalApiService {
  private bridge(): AgentBridge | undefined {
    return (window as unknown as { jarvisDesktop?: AgentBridge }).jarvisDesktop;
  }

  get available(): boolean {
    return typeof this.bridge()?.agentProposalApi === 'function';
  }

  private async request<T>(message: AgentProposalRequest): Promise<T> {
    const call = this.bridge()?.agentProposalApi;
    if (!call) throw new Error('Otwórz aplikację J.A.R.V.I.S. w Electronie.');
    let result: Result;
    try {
      result = await call(message);
    } catch {
      throw new Error('Połączenie z lokalnym backendem nie powiodło się.');
    }
    if (!result.ok) throw new Error(`Agent: ${result.error}`);
    return result.data as T;
  }

  list(): Promise<AgentProposal[]> { return this.request({ operation: 'list' }); }
  generate(task: string, sources?: readonly AgentCodeSource[]): Promise<AgentProposal> {
    return this.request({ operation: 'generate', task, ...(sources?.length ? { sources } : {}) });
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
