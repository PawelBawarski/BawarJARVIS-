import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AiLabApiService } from './ai-lab-api';

describe('AiLabApiService', () => {
  afterEach(() => { delete (window as unknown as {jarvisDesktop?: unknown}).jarvisDesktop; vi.restoreAllMocks(); vi.unstubAllGlobals(); });
  it('maps browser requests to secured backend routes', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ok:true,status:200,json:async()=>({status:'IDLE',losses:[]})});
    vi.stubGlobal('fetch', fetchMock);
    TestBed.configureTestingModule({});
    const api = TestBed.inject(AiLabApiService);
    expect(api.available).toBe(true);
    await expect(api.state()).resolves.toMatchObject({status:'IDLE'});
    expect(fetchMock).toHaveBeenCalledWith('/api/ai-lab/training', {method:'GET',credentials:'same-origin'});
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
