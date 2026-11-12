import { browserApi } from './browser-api';
import { Injectable } from '@angular/core';

export interface LabTrainingState {
  readonly id: string | null;
  readonly status: 'IDLE' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  readonly epoch: number;
  readonly totalEpochs: number;
  readonly losses: readonly number[];
  readonly error: string | null;
}
export interface LabModelStatus {
  readonly vocabularySize: number;
  readonly contextLength: number;
  readonly trainedExamplesThisSession: number;
  readonly checkpointAvailable: boolean;
  readonly restoredFromCheckpoint: boolean;
}
export interface LabTrainingRunRecord { readonly id: string; readonly status: string; readonly startedAt: string; readonly finishedAt: string | null; readonly totalEpochs: number; readonly completedEpochs: number; readonly exampleCount: number; readonly finalLoss: number | null; readonly error: string | null; }
export interface LabEpochRecord { readonly epoch: number; readonly loss: number; }
export interface LabCheckpointRecord { readonly id: string; readonly trainingRunId: string | null; readonly createdAt: string; readonly modelVersion: string; readonly fileBytes: number; readonly sha256: string; readonly trainingLoss: number | null; readonly evaluationPerplexity: number | null; readonly evaluationCorpusSha256: string | null; }
export interface LabEvaluationRecord { readonly id: string; readonly checkpointId: string | null; readonly createdAt: string; readonly meanCrossEntropy: number; readonly perplexity: number; readonly exampleCount: number; readonly corpusSha256: string; }
export interface LabDatasetSummary { readonly id:string; readonly name:string; readonly createdAt:string; readonly latestVersionId:string; readonly latestVersion:number; readonly trainingCount:number; readonly validationCount:number; readonly validationSha256:string; }
export interface LabDatasetVersion { readonly id:string; readonly datasetId:string; readonly versionNumber:number; readonly createdAt:string; readonly trainingCount:number; readonly validationCount:number; readonly contentSha256:string; readonly validationSha256:string; }
export interface LabDatasetContent { readonly id:string; readonly datasetId:string; readonly name:string; readonly versionNumber:number; readonly validationSha256:string; readonly trainingExamples:readonly string[]; readonly validationExamples:readonly string[]; }
export type LabApiRequest =
  | { operation: 'state' | 'model' | 'save' | 'load' }
  | { operation: 'train'; examples: string[]; epochs: number }
  | { operation: 'evaluate'; examples: string[] }
  | { operation: 'historyRuns' | 'historyCheckpoints' | 'historyEvaluations' }
  | { operation: 'historyEpochs'; id: string }
  | { operation: 'datasetList' }
  | { operation: 'datasetCreate'; name: string; examples: string[] }
  | { operation: 'datasetVersions' | 'datasetRead'; id: string }
  | { operation: 'datasetRevise'; id: string; examples: string[] };
export type LabApiResult =
  | { ok: true; status: number; data: unknown }
  | { ok: false; status: number; error: string };

@Injectable({ providedIn: 'root' })
export class AiLabApiService {
  get available(): boolean { return true; }
  private async request<T>(request: LabApiRequest): Promise<T> {
    const bridge = window.jarvisDesktop?.aiLabApi;
    if (bridge) {
      let result: LabApiResult;
      try { result = await bridge(request); }
      catch { throw new Error('BACKEND_UNAVAILABLE'); }
      if (!result.ok) throw new Error(result.error);
      return result.data as T;
    }
    const base = '/api/ai-lab';
    const id = 'id' in request ? encodeURIComponent(request.id) : '';
    switch (request.operation) {
      case 'state': return browserApi<T>('GET', `${base}/training`);
      case 'model': return browserApi<T>('GET', `${base}/model`);
      case 'train': return browserApi<T>('POST', `${base}/training`, { examples: request.examples, epochs: request.epochs });
      case 'save': return browserApi<T>('POST', `${base}/checkpoint/save`);
      case 'load': return browserApi<T>('POST', `${base}/checkpoint/load`);
      case 'evaluate': return browserApi<T>('POST', `${base}/evaluate`, { examples: request.examples });
      case 'historyRuns': return browserApi<T>('GET', `${base}/history/runs`);
      case 'historyCheckpoints': return browserApi<T>('GET', `${base}/history/checkpoints`);
      case 'historyEvaluations': return browserApi<T>('GET', `${base}/history/evaluations`);
      case 'historyEpochs': return browserApi<T>('GET', `${base}/history/runs/${id}/epochs`);
      case 'datasetList': return browserApi<T>('GET', `${base}/datasets`);
      case 'datasetCreate': return browserApi<T>('POST', `${base}/datasets`, { name: request.name, examples: request.examples });
      case 'datasetVersions': return browserApi<T>('GET', `${base}/datasets/${id}/versions`);
      case 'datasetRead': return browserApi<T>('GET', `${base}/datasets/versions/${id}`);
      case 'datasetRevise': return browserApi<T>('POST', `${base}/datasets/${id}/versions`, { examples: request.examples });
    }
  }

  state(): Promise<LabTrainingState> { return this.request({ operation: 'state' }); }
  model(): Promise<LabModelStatus> { return this.request({ operation: 'model' }); }
  start(examples: string[], epochs: number): Promise<LabTrainingState> {
    return this.request({ operation: 'train', examples, epochs });
  }
  save(): Promise<LabModelStatus> { return this.request({ operation: 'save' }); }
  load(): Promise<LabModelStatus> { return this.request({ operation: 'load' }); }
  evaluate(examples: string[]): Promise<{ meanCrossEntropy: number; perplexity: number }> {
    return this.request({ operation: 'evaluate', examples });
  }
  historyRuns(): Promise<LabTrainingRunRecord[]> { return this.request({ operation: 'historyRuns' }); }
  historyCheckpoints(): Promise<LabCheckpointRecord[]> { return this.request({ operation: 'historyCheckpoints' }); }
  historyEvaluations(): Promise<LabEvaluationRecord[]> { return this.request({ operation: 'historyEvaluations' }); }
  historyEpochs(id: string): Promise<LabEpochRecord[]> { return this.request({ operation: 'historyEpochs', id }); }
  datasetList(): Promise<LabDatasetSummary[]> { return this.request({ operation: 'datasetList' }); }
  datasetCreate(name: string, examples: string[]): Promise<LabDatasetVersion> { return this.request({operation:'datasetCreate',name,examples}); }
  datasetVersions(id: string): Promise<LabDatasetVersion[]> { return this.request({operation:'datasetVersions',id}); }
  datasetRead(id: string): Promise<LabDatasetContent> { return this.request({operation:'datasetRead',id}); }
  datasetRevise(id: string, examples: string[]): Promise<LabDatasetVersion> { return this.request({operation:'datasetRevise',id,examples}); }
}
