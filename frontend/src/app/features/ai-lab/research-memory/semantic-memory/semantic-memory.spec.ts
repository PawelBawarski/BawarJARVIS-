import { TestBed } from '@angular/core/testing';
import { describe, it, expect, vi } from 'vitest';
import { SemanticMemory } from './semantic-memory';
import { ResearchSemanticApi } from '../../../../core/services/research-semantic-api';
import { TranslationService } from '../../../../core/services/translation';

const status = { configured: true, model: 'jarvis-qwen3-embedding-0.6b', knowledgeCount: 3, indexedCount: 0, batchLimit: 5, scanLimit: 5000 };

async function setup() {
  const api = {
    status: vi.fn().mockResolvedValue(status),
    indexNext: vi.fn().mockResolvedValue({ processed: 3, indexedCount: 3, knowledgeCount: 3 }),
    search: vi.fn().mockResolvedValue([{ id: '1', title: 'Java', url: 'jarvis://note/1', excerpt: 'JDK', similarity: .8, method: 'semantic' }]),
  };
  await TestBed.configureTestingModule({ imports: [SemanticMemory], providers: [
    { provide: ResearchSemanticApi, useValue: api },
    { provide: TranslationService, useValue: { translate: (key: string) => key, dictionaryVersion: () => 0 } },
  ] }).compileComponents();
  const fixture = TestBed.createComponent(SemanticMemory);
  fixture.detectChanges();
  return { api, component: fixture.componentInstance };
}

describe('20.3 local semantic memory', () => {
  it('does not trigger indexing or retrieval automatically', async () => {
    const { api, component } = await setup();
    expect(api.indexNext).not.toHaveBeenCalled();
    expect(api.search).not.toHaveBeenCalled();
    await component.refresh();
    expect(api.indexNext).not.toHaveBeenCalled();
    await component.indexNext();
    expect(api.indexNext).toHaveBeenCalledTimes(1);
  });

  it('searches only after explicit request and keeps text', async () => {
    const { api, component } = await setup();
    component.query.set('explain the JDK');
    await component.search();
    expect(api.search).toHaveBeenCalledExactlyOnceWith('explain the JDK');
    expect(component.hits()[0].title).toBe('Java');
  });
});
