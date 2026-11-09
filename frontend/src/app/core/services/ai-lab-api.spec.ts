import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AiLabApiService } from './ai-lab-api';

describe('AiLabApiService', () => {
  afterEach(() => { delete (window as unknown as {jarvisDesktop?: unknown}).jarvisDesktop; });
  it('does not expose a web fallback', async () => {
    TestBed.configureTestingModule({});
    const api = TestBed.inject(AiLabApiService);
    expect(api.available).toBe(false);
    await expect(api.state()).rejects.toThrow('DESKTOP_BRIDGE_UNAVAILABLE');
  });
  it('passes bounded operation object through Electron bridge only', async () => {
    const bridge = vi.fn().mockResolvedValue({ ok: true, status: 200, data: {status:'IDLE',losses:[]} });
    (window as unknown as {jarvisDesktop?: unknown}).jarvisDesktop = {aiLabApi: bridge};
    TestBed.configureTestingModule({});
    const api = TestBed.inject(AiLabApiService);
    expect((await api.state()).status).toBe('IDLE');
    expect(bridge).toHaveBeenCalledWith({operation:'state'});
  });
  it('propagates server rejection', async () => {
    (window as unknown as {jarvisDesktop?: unknown}).jarvisDesktop = {aiLabApi: vi.fn().mockResolvedValue({ok:false,status:409,error:'MODEL_BUSY'})};
    TestBed.configureTestingModule({});
    await expect(TestBed.inject(AiLabApiService).save()).rejects.toThrow('MODEL_BUSY');
  });
});
