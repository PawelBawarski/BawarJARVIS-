import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { AiLabApiService } from '../../../core/services/ai-lab-api';
import { AiLabHistoryPanel } from './history-panel';

const ckpt = (id: string, hash: string, corpus: string | null, ppl: number | null) => ({
  id, sha256: hash, evaluationCorpusSha256: corpus, evaluationPerplexity: ppl,
  trainingRunId: null, createdAt: '2026-11-09T10:00:00Z', modelVersion: 'tiny',
  fileBytes: 42, trainingLoss: null,
});

describe('AiLabHistoryPanel', () => {
  it('compares perplexities only on the same evaluation corpus', () => {
    TestBed.configureTestingModule({providers:[{provide:AiLabApiService,useValue:{available:false}}]});
    const panel=TestBed.runInInjectionContext(()=>new AiLabHistoryPanel());
    panel.checkpoints.set([ckpt('1','a','x',1.5),ckpt('2','b','y',1.3)]);
    panel.first.set('1');panel.second.set('2');
    expect(panel.canCompareEvaluations()).toBe(false);
    panel.checkpoints.set([ckpt('1','a','x',1.5),ckpt('2','b','x',1.3)]);
    expect(panel.canCompareEvaluations()).toBe(true);
  });
  it('rejects invalid evaluation corpus before sending IPC request', async () => {
    const evaluate=vi.fn();
    TestBed.configureTestingModule({providers:[{provide:AiLabApiService,useValue:{available:true,evaluate}}]});
    const panel=TestBed.runInInjectionContext(()=>new AiLabHistoryPanel());
    panel.evalText.set('');
    await panel.evaluate();
    expect(panel.error()).toBe('INVALID_EVALUATION_INPUT');
    expect(evaluate).not.toHaveBeenCalled();
  });
  it('reads persisted runs, epochs and checkpoint metadata', async () => {
    const api = {
      available:true,
      historyRuns:vi.fn().mockResolvedValue([{id:'a',status:'completed'}]),
      historyEpochs:vi.fn().mockResolvedValue([{epoch:1,loss:0.4}]),
      historyCheckpoints:vi.fn().mockResolvedValue([]),
      historyEvaluations:vi.fn().mockResolvedValue([]),
    };
    TestBed.configureTestingModule({providers:[{provide:AiLabApiService,useValue:api}]});
    const panel=TestBed.runInInjectionContext(()=>new AiLabHistoryPanel());
    await panel.refresh();
    expect(panel.selectedRun()).toBe('a');
    expect(panel.epochs()).toEqual([{epoch:1,loss:0.4}]);
  });
});
