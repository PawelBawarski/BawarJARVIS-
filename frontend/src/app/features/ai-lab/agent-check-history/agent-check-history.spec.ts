import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AgentCheckHistory } from './agent-check-history';
import { AgentProjectCheckHistoryApiService } from '../../../core/services/agent-project-check-history-api';
import { TranslationService } from '../../../core/services/translation';

const example = (id: string, status: 'passed' | 'failed', proposed = 'a'.repeat(64)) => ({
  checkId: id, kind: 'angular' as const, status, relativePath: 'src/app/demo.ts',
  proposedSha256: proposed, snapshotSha256: 'c'.repeat(64), image: 'jarvis-test',
  fileCount: 5, elapsedMs: id === '1' ? 100 : 125, createdAt: '2026-11-13T10:00:00Z',
});

describe('19.5 check history', () => {
  const api = { list: vi.fn() };
  beforeEach(async () => {
    vi.resetAllMocks();
    api.list.mockResolvedValue([example('1', 'passed'), example('2', 'failed', 'b'.repeat(64))]);
    await TestBed.configureTestingModule({
      imports: [AgentCheckHistory],
      providers: [
        { provide: AgentProjectCheckHistoryApiService, useValue: api },
        { provide: TranslationService, useValue: { translate: (key: string) => key, dictionaryVersion: () => 0 } },
      ],
    }).compileComponents();
  });
  it('never loads history before explicit refresh', async () => {
    const f = TestBed.createComponent(AgentCheckHistory);
    f.detectChanges();
    expect(api.list).not.toHaveBeenCalled();
    await f.componentInstance.refresh();
    f.detectChanges();
    expect(api.list).toHaveBeenCalledTimes(1);
    expect(f.nativeElement.querySelectorAll('tbody tr')).toHaveLength(2);
    expect(f.componentInstance.comparable()).toBe(true);
    expect(f.componentInstance.differentCode()).toBe(true);
    expect(f.componentInstance.elapsedDifference()).toBe(25);
  });
  it('does not compare unrelated targets', async () => {
    api.list.mockResolvedValue([example('1', 'passed'), { ...example('2', 'failed'), relativePath: 'src/app/other.ts' }]);
    const f = TestBed.createComponent(AgentCheckHistory);
    await f.componentInstance.refresh();
    expect(f.componentInstance.comparable()).toBe(false);
  });
  it('does not falsely claim a load succeeded after API failure', async () => {
    api.list.mockRejectedValue(new Error('offline'));
    const f = TestBed.createComponent(AgentCheckHistory);
    await f.componentInstance.refresh();
    expect(f.componentInstance.error()).toBe(true);
    expect(f.componentInstance.loaded()).toBe(false);
  });
});
