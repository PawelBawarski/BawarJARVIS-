import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { WorkspaceApiService } from '../../../core/services/workspace-api';
import { AiLabWorkspacePanel } from './workspace-panel';

describe('AiLabWorkspacePanel', () => {
  it('never enables workspace writes', async () => {
    const api = {
      available: true,
      choose: vi.fn().mockResolvedValue({ selected: 'C:/projects/demo', readOnly: true, writeEnabled: false }),
      list: vi.fn().mockResolvedValue({ relativePath: '', entries: [] }),
    };
    TestBed.configureTestingModule({ providers: [{ provide: WorkspaceApiService, useValue: api }] });
    const panel = TestBed.runInInjectionContext(() => new AiLabWorkspacePanel());
    await panel.choose();
    expect(panel.workspace()?.writeEnabled).toBe(false);
    expect(api.choose).toHaveBeenCalledOnce();
  });
  it('opens an approved text file through the read-only bridge', async () => {
    const read = vi.fn().mockResolvedValue({ relativePath: 'src/main.ts', content: 'const x=1', size: 9 });
    TestBed.configureTestingModule({ providers: [{ provide: WorkspaceApiService, useValue: { available: true, read } }] });
    const panel = TestBed.runInInjectionContext(() => new AiLabWorkspacePanel());
    await panel.open({ name: 'main.ts', kind: 'file', relativePath: 'src/main.ts' });
    expect(read).toHaveBeenCalledWith('src/main.ts');
    expect(panel.preview()?.content).toBe('const x=1');
  });
});
