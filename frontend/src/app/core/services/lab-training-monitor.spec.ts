import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AiLabApiService, LabTrainingState } from './ai-lab-api';
import { LabTrainingMonitor } from './lab-training-monitor';
import { ModuleNavigationService } from './module-navigation.service';

const running = (status: LabTrainingState['status']): LabTrainingState => ({
  id: 'run-1', status, epoch: 1, totalEpochs: 3, losses: [], error: null,
});

describe('LabTrainingMonitor — single HTTP polling source', () => {
  let api: { state: ReturnType<typeof vi.fn> };
  let page: Document;

  beforeEach(() => {
    vi.useFakeTimers();
    page = Object.assign(new EventTarget(), { hidden: false }) as unknown as Document;
    api = { state: vi.fn().mockResolvedValue(running('RUNNING')) };
    TestBed.configureTestingModule({
      providers: [
        { provide: DOCUMENT, useValue: page },
        { provide: AiLabApiService, useValue: api },
      ],
    });
    TestBed.inject(ModuleNavigationService).select('lab');
  });
  afterEach(() => {
    TestBed.resetTestingModule();
    vi.useRealTimers();
  });

  it('deduplicates two consumers and stops polling after the job completes', async () => {
    const monitor = TestBed.inject(LabTrainingMonitor);
    monitor.acquire();
    monitor.acquire(); // training and dataset panels
    api.state.mockResolvedValueOnce(running('RUNNING')).mockResolvedValueOnce(running('COMPLETED'));
    await Promise.all([monitor.refresh(), monitor.refresh()]);
    expect(api.state).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(2_000);
    expect(api.state).toHaveBeenCalledTimes(2);
    expect(monitor.state()?.status).toBe('COMPLETED');
    await vi.advanceTimersByTimeAsync(10_000);
    expect(api.state).toHaveBeenCalledTimes(2);
    monitor.release();
    monitor.release();
  });

  it('does not overlap requests and ignores an outdated GET after POST training', async () => {
    const monitor = TestBed.inject(LabTrainingMonitor);
    monitor.acquire();
    let resolve!: (value: LabTrainingState) => void;
    api.state.mockImplementationOnce(() => new Promise<LabTrainingState>(r => resolve = r));
    const first = monitor.refresh();
    const second = monitor.refresh();
    await Promise.resolve();
    expect(api.state).toHaveBeenCalledTimes(1);
    monitor.report(running('COMPLETED'));
    resolve(running('RUNNING'));
    await Promise.all([first, second]);
    expect(monitor.state()?.status).toBe('COMPLETED');
    await vi.advanceTimersByTimeAsync(5_000);
    expect(api.state).toHaveBeenCalledTimes(1);
    monitor.release();
  });

  it('does not request status while another J.A.R.V.I.S. module is selected', async () => {
    const nav = TestBed.inject(ModuleNavigationService);
    const monitor = TestBed.inject(LabTrainingMonitor);
    monitor.acquire();
    await monitor.refresh();
    nav.select('chat');
    await vi.advanceTimersByTimeAsync(8_000);
    expect(api.state).toHaveBeenCalledTimes(1);
    monitor.release();
  });

  it('pauses when tab is hidden, resumes on return and stops after release', async () => {
    const monitor = TestBed.inject(LabTrainingMonitor);
    monitor.acquire();
    await monitor.refresh();
    Object.assign(page, { hidden: true });
    page.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(10_000);
    expect(api.state).toHaveBeenCalledTimes(1);
    Object.assign(page, { hidden: false });
    page.dispatchEvent(new Event('visibilitychange'));
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(0);
    expect(api.state).toHaveBeenCalledTimes(2);
    monitor.release();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(api.state).toHaveBeenCalledTimes(2);
  });
});
