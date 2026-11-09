import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { AiLabApiService } from '../../../core/services/ai-lab-api';
import { AiTrainingPanel } from './training-panel';

describe('AiTrainingPanel', () => {
  it('rejects an invalid number of epochs without calling backend', async () => {
    const start=vi.fn();
    TestBed.configureTestingModule({providers:[{provide:AiLabApiService,useValue:{available:true,start,state:vi.fn(),model:vi.fn()}}]});
    const instance=TestBed.runInInjectionContext(()=>new AiTrainingPanel());
    instance.epochs.set(0);
    await instance.start();
    expect(start).not.toHaveBeenCalled();
    expect(instance.error()).toBe('INVALID_TRAINING_INPUT');
  });
  it('sends examples and epochs to real API abstraction', async () => {
    const start=vi.fn().mockResolvedValue({id:'1',status:'RUNNING',epoch:0,totalEpochs:2,losses:[],error:null});
    TestBed.configureTestingModule({providers:[{provide:AiLabApiService,useValue:{available:true,start}}]});
    const instance=TestBed.runInInjectionContext(()=>new AiTrainingPanel());
    instance.text.set('ala\nma kota');instance.epochs.set(2);
    await instance.start();
    expect(start).toHaveBeenCalledWith(['ala','ma kota'],2);
    expect(instance.state()?.status).toBe('RUNNING');
  });
});
