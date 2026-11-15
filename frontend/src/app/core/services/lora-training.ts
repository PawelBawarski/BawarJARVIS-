import { Injectable } from '@angular/core';
import { browserApi } from './browser-api';

export interface LoraRun {
  runId: string | null;
  status: string;
  step: number;
  totalSteps: number;
  loss: number | null;
  vramMiB: number | null;
  error: string | null;
  processAlive: boolean;
}

@Injectable({ providedIn: 'root' })
export class LoraTrainingService {
  status(): Promise<LoraRun> { return browserApi<LoraRun>('GET', '/api/ai-lab/lora/status', undefined, { retries: 0 }); }
  start(steps: number, seqLen: number, datasetId?: string): Promise<LoraRun> {
    return browserApi<LoraRun>('POST', '/api/ai-lab/lora/start', { steps, seqLen, datasetId });
  }
  stop(): Promise<LoraRun> { return browserApi<LoraRun>('POST', '/api/ai-lab/lora/stop'); }
  datasets(): Promise<import('./lora-evidence').LoraDataset[]> { return browserApi<import('./lora-evidence').LoraDataset[]>('GET','/api/ai-lab/lora/datasets'); }
  history(): Promise<LoraRun[]> { return browserApi<LoraRun[]>('GET', '/api/ai-lab/lora/history'); }
}
