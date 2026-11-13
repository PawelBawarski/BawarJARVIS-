import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AgentFileWrite } from './agent-file-write';
import { AgentIsolatedCheckApiService } from '../../../core/services/agent-isolated-check-api';
import { AgentFileWriteApiService } from '../../../core/services/agent-file-write-api';
import { TranslationService } from '../../../core/services/translation';

const preview = { relativePath: 'demo.ts', original: 'old', proposed: 'new', diff: '-old\n+new', notice: 'Preview' };

describe('19.1 Controlled web file changes', () => {
  const api = { status: vi.fn(), history: vi.fn(), prepare: vi.fn(), apply: vi.fn(), rollback: vi.fn() };
  beforeEach(async () => {
    vi.resetAllMocks();
    api.status.mockResolvedValue({ enabled: true, scope: 'C:/SafeProject', notice: 'Ready' });
    api.history.mockResolvedValue([]);
    api.prepare.mockResolvedValue({ ticket: 'permit', relativePath: 'demo.ts', beforeSha256: 'a'.repeat(64), afterSha256: 'b'.repeat(64), expiresInSeconds: 300, notice: 'Ready' });
    api.apply.mockResolvedValue({ status: 'applied', relativePath: 'demo.ts', deploymentId: 'deployment', message: 'Saved' });
    api.rollback.mockResolvedValue({ status: 'rolled_back', relativePath: 'demo.ts', deploymentId: 'deployment', message: 'Restored' });
    await TestBed.configureTestingModule({ imports: [AgentFileWrite], providers: [
      { provide: AgentFileWriteApiService, useValue: api },
      { provide: AgentIsolatedCheckApiService, useValue: { status: vi.fn().mockResolvedValue({ enabled: false, notice: 'Disabled' }) } },
      { provide: TranslationService, useValue: { translate: (key: string) => key, dictionaryVersion: () => 0 } },
    ] }).compileComponents();
  });

  it('requires two separate user actions before any write', async () => {
    const f = TestBed.createComponent(AgentFileWrite);
    f.componentRef.setInput('preview', preview);
    f.detectChanges();await f.whenStable();
    expect(api.prepare).not.toHaveBeenCalled();expect(api.apply).not.toHaveBeenCalled();
    f.componentInstance.consent.set(true);await f.componentInstance.prepare();
    expect(api.prepare).toHaveBeenCalledOnce();expect(api.apply).not.toHaveBeenCalled();
    await f.componentInstance.apply();expect(api.apply).toHaveBeenCalledWith('permit');
  });
  it('never applies a ticket after the preview changes', async () => {
    const f = TestBed.createComponent(AgentFileWrite);
    f.componentRef.setInput('preview', preview);f.detectChanges();await f.whenStable();
    f.componentInstance.consent.set(true);await f.componentInstance.prepare();
    f.componentRef.setInput('preview', { ...preview, proposed: 'different' });f.detectChanges();
    expect(f.componentInstance.canApply()).toBe(false);
    await f.componentInstance.apply();expect(api.apply).not.toHaveBeenCalled();
  });
  it('disabled backend does not prepare or write', async () => {
    api.status.mockResolvedValue({ enabled: false, scope: '', notice: 'Disabled' });
    const f = TestBed.createComponent(AgentFileWrite);
    f.componentRef.setInput('preview', preview);f.detectChanges();await f.whenStable();
    f.componentInstance.consent.set(true);await f.componentInstance.prepare();
    expect(api.prepare).not.toHaveBeenCalled();expect(api.apply).not.toHaveBeenCalled();
  });
});
