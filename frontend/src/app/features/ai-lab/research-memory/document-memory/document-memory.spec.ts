import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { DocumentMemory } from './document-memory';
import { ResearchDocumentApi } from '../../../../core/services/research-document-api';
import { TranslationService } from '../../../../core/services/translation';

const saved = { id: 'doc1', fileName: 'notes.md', kind: 'md', byteSize: 24, chunkCount: 1, createdAt: '2026-11-13T12:00:00Z' };

async function setup() {
  const api = { list: vi.fn().mockResolvedValue([]), importFile: vi.fn().mockResolvedValue(saved), remove: vi.fn().mockResolvedValue(undefined) };
  await TestBed.configureTestingModule({
    imports: [DocumentMemory],
    providers: [
      { provide: ResearchDocumentApi, useValue: api },
      { provide: TranslationService, useValue: { translate: (key: string) => key, dictionaryVersion: () => 0 } }
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(DocumentMemory);
  fixture.detectChanges();
  return { fixture, api };
}

describe('Document Memory 20.2', () => {
  it('does not upload anything until the user explicitly confirms', async () => {
    const { fixture, api } = await setup();
    const component = fixture.componentInstance;
    component.selectedFile.set(new File(['# Notes'], 'notes.md', { type: 'text/markdown' }));
    fixture.detectChanges();
    expect(api.importFile).not.toHaveBeenCalled();
    await component.importSelected();
    expect(api.importFile).toHaveBeenCalledTimes(1);
    expect(component.documents()[0].fileName).toBe('notes.md');
  });

  it('requires a second action before deleting', async () => {
    const { fixture, api } = await setup();
    const component = fixture.componentInstance;
    component.documents.set([saved as any]);
    component.requestDelete('doc1');
    expect(api.remove).not.toHaveBeenCalled();
    component.cancelDelete();
    await component.confirmDelete('doc1');
    expect(api.remove).not.toHaveBeenCalled();
    component.requestDelete('doc1');
    await component.confirmDelete('doc1');
    expect(api.remove).toHaveBeenCalledExactlyOnceWith('doc1');
  });
});
