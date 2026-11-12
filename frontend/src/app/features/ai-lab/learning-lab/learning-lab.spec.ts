import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LearningLab } from './learning-lab';
import { TranslationService } from '../../../core/services/translation';

describe('LearningLab — integration with isolated offline service', () => {
  afterEach(() => vi.unstubAllGlobals());
  async function setup() {
    await TestBed.configureTestingModule({ imports: [LearningLab], providers: [{provide: TranslationService, useValue: { translate: (key:string) => key === 'lab.learning.intro' ? 'Bez Ollama, bez modelu GPT.' : key, dictionaryVersion:()=>0 }}] }).compileComponents();
    const fixture = TestBed.createComponent(LearningLab);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance };
  }
  it('renders a local model warning and the memory editor', async () => {
    const { fixture } = await setup();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Bez Ollama');
    expect(text).toContain('Learning');
    expect(text).toContain('Training');
  });
  it('requires the explicit local token and does not issue unauthenticated requests', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { component } = await setup();
    component.question.set('2+2');
    await component.ask();
    expect(component.error()).toBe('lab.learning.tokenMissing');
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('sends a verified reasoning request with a token only in memory', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ answer: '4', sources: [], steps: [] }) });
    vi.stubGlobal('fetch', fetchMock);
    const { component } = await setup();
    component.token.set('temporary-memory-only');
    component.question.set('2+2');
    await component.ask();
    expect(component.answer()).toBe('4');
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/api/ai/reason'), expect.objectContaining({method:'POST'}));
  });
});
