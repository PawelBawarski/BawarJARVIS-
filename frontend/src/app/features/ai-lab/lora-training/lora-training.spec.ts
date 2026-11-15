import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { LoraTraining } from './lora-training';
import { LoraTrainingService } from '../../../core/services/lora-training';
import { TranslationService } from '../../../core/services/translation';

const idle = { runId: null, status: 'idle', step: 0, totalSteps: 0, loss: null, vramMiB: null, error: null, processAlive: false };

describe('LoraTraining', () => {
  it('shows real controls and refuses invalid steps without calling API', async () => {
    const api = { status: vi.fn().mockResolvedValue(idle), history: vi.fn().mockResolvedValue([]), datasets: vi.fn().mockResolvedValue([]),
      start: vi.fn(), stop: vi.fn() };
    TestBed.configureTestingModule({ providers: [
      { provide: LoraTrainingService, useValue: api },
      { provide: TranslationService, useValue: { translate: (key: string) => key } },
    ]});
    const fixture = TestBed.createComponent(LoraTraining);
    fixture.detectChanges();
    fixture.componentInstance.steps.set(201);
    await fixture.componentInstance.start();
    expect(api.start).not.toHaveBeenCalled();
    expect(fixture.componentInstance.error()).toBe('lab.lora.validation');
    fixture.destroy();
  });
  it('starts only after explicit user action', async () => {
    const active = { ...idle, runId: 'lora-test', status: 'running', processAlive: true, totalSteps: 6 };
    const api = { status: vi.fn().mockResolvedValue(idle), history: vi.fn().mockResolvedValue([]), datasets: vi.fn().mockResolvedValue([]),
      start: vi.fn().mockResolvedValue(active), stop: vi.fn().mockResolvedValue(idle) };
    TestBed.configureTestingModule({ providers: [
      { provide: LoraTrainingService, useValue: api },
      { provide: TranslationService, useValue: { translate: (key: string) => key } },
    ]});
    const fixture = TestBed.createComponent(LoraTraining);
    fixture.detectChanges();
    expect(api.start).not.toHaveBeenCalled();
    await fixture.componentInstance.start();
    expect(api.start).toHaveBeenCalledWith(6,128,undefined);
    fixture.destroy();
  });
});
