import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { ResearchApiService } from '../../../core/services/research-api';
import { TranslationService } from '../../../core/services/translation';
import { ResearchMemory } from './research-memory';

const local = { id: 'note1', title: 'My Angular notes', excerpt: 'Signals are reactive', url: 'jarvis://note/note1' };

describe('Research Memory 20.1 – local knowledge', () => {
  it('never writes a note before explicit save, and clears draft only after success', async () => {
    const api = { saveLocal: vi.fn().mockResolvedValue(local), list: vi.fn(), remove: vi.fn(), matches: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [ResearchMemory],
      providers: [
        { provide: ResearchApiService, useValue: api },
        { provide: TranslationService, useValue: { translate: (k: string) => k, dictionaryVersion: () => 0 } }
      ]
    }).compileComponents();
    const view = TestBed.createComponent(ResearchMemory);
    view.detectChanges();
    expect(api.saveLocal).not.toHaveBeenCalled();
    view.componentInstance.noteTitle.set(' My Angular notes ');
    view.componentInstance.noteContent.set(' Signals are reactive ');
    await view.componentInstance.saveLocal();
    view.detectChanges();
    expect(api.saveLocal).toHaveBeenCalledExactlyOnceWith('My Angular notes', 'Signals are reactive');
    expect(view.componentInstance.noteTitle()).toBe('');
    expect(view.componentInstance.notes()).toEqual([local]);
    expect(view.nativeElement.querySelector('[data-testid="research-notes"]')).not.toBeNull();
    expect(view.nativeElement.querySelector('[data-testid="research-notes"] button')?.textContent).toContain('lab.research.remove');
  });

  it('searches only on request and shows results', async () => {
    const api = { matches: vi.fn().mockResolvedValue([local]) };
    await TestBed.configureTestingModule({
      imports: [ResearchMemory],
      providers: [
        { provide: ResearchApiService, useValue: api },
        { provide: TranslationService, useValue: { translate: (k: string) => k, dictionaryVersion: () => 0 } }
      ]
    }).compileComponents();
    const view = TestBed.createComponent(ResearchMemory);
    view.detectChanges();
    expect(api.matches).not.toHaveBeenCalled();
    view.componentInstance.memoryQuery.set('Angular');
    await view.componentInstance.findLocal();
    view.detectChanges();
    expect(api.matches).toHaveBeenCalledExactlyOnceWith('Angular');
    expect(view.nativeElement.querySelector('[data-testid="memory-search-results"]')).not.toBeNull();
  });
});
