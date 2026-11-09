import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { AiLabApiService } from '../../../core/services/ai-lab-api';
import { AiLabDatasetPanel } from './dataset-panel';

const dataset = {
  id:'123e4567-e89b-42d3-a456-426614174000',
  name:'Próbki', versionNumber:1, validationSha256:'a'.repeat(64),
  datasetId:'123e4567-e89b-42d3-a456-426614174001',
  trainingExamples:['a','b','c','d'],validationExamples:['e'],
};
const api = () => ({
  available: true,
  datasetList:vi.fn().mockResolvedValue([]),
  datasetCreate:vi.fn().mockResolvedValue({id:dataset.id,datasetId:dataset.datasetId}),
  datasetVersions:vi.fn().mockResolvedValue([{id:dataset.id,versionNumber:1}]),
  datasetRead:vi.fn().mockResolvedValue(dataset),
  datasetRevise:vi.fn().mockResolvedValue({id:dataset.id,datasetId:dataset.datasetId}),
  state:vi.fn().mockResolvedValue({status:'IDLE'}),
  start:vi.fn().mockResolvedValue({status:'RUNNING'}),
  evaluate:vi.fn().mockResolvedValue({meanCrossEntropy:0.3,perplexity:1.35}),
});
function component(mock: ReturnType<typeof api>) {
  TestBed.configureTestingModule({providers:[{provide:AiLabApiService,useValue:mock}]});
  return TestBed.runInInjectionContext(()=>new AiLabDatasetPanel());
}
describe('AiLabDatasetPanel', () => {
  it('rejects duplicate and undersized datasets before IPC', async () => {
    const mock=api(); const panel=component(mock);
    panel.name.set('Zestaw'); panel.draft.set('a\nb\nc\nd\na');
    await panel.create();
    expect(mock.datasetCreate).not.toHaveBeenCalled();
    expect(panel.error()).toBe('INVALID_DATASET_INPUT');
  });
  it('creates a dataset and restores the saved version', async () => {
    const mock=api(); const panel=component(mock);
    panel.name.set('Zestaw'); panel.draft.set('a\nb\nc\nd\ne');
    await panel.create();
    expect(mock.datasetCreate).toHaveBeenCalledOnce();
    expect(panel.selectedVersion()).toBe(dataset.id);
    expect(panel.loaded()?.validationExamples).toEqual(['e']);
  });
  it('trains exclusively on training subset and evaluates validation', async () => {
    const mock=api(); const panel=component(mock);
    panel.loaded.set(dataset); panel.epochs.set(3);
    await panel.train(); await panel.evaluate();
    expect(mock.start).toHaveBeenCalledWith(['a','b','c','d'],3);
    expect(mock.evaluate).toHaveBeenCalledWith(['e']);
  });
  it('does not start training while a job is running', async () => {
    const mock=api(); mock.state.mockResolvedValue({status:'RUNNING'});
    const panel=component(mock); panel.loaded.set(dataset);
    await panel.train();
    expect(mock.start).not.toHaveBeenCalled();
    expect(panel.error()).toBe('TRAINING_ALREADY_RUNNING');
  });
});
