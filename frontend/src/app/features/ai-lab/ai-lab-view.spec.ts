import { Pipe, PipeTransform } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { TranslationService } from '../../core/services/translation';
import { beforeEach, describe, expect, it } from 'vitest';

import { AiLabView } from './ai-lab-view';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';

@Pipe({
  name: 'translate',
  standalone: true,
})
class MockTranslatePipe implements PipeTransform {
  transform(key: string): string {
    return key;
  }
}

describe('AiLabView', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AiLabView],
      providers: [provideHttpClient(), { provide: TranslationService, useValue: { translate: (key: string) => key } }],
    })
      .overrideComponent(AiLabView, {
        remove: { imports: [TranslatePipe] },
        add: { imports: [MockTranslatePipe] },
      })
      .compileComponents();
  });

  it('should create component', () => {
    const fixture = TestBed.createComponent(AiLabView);

    expect(fixture.componentInstance).toBeTruthy();
  });

  it('has independently collapsible research, agent, advanced and offline areas', () => {
    const fixture = TestBed.createComponent(AiLabView);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const research = root.querySelector<HTMLDetailsElement>('[data-testid="ai-lab-research-section"]');
    const agent = root.querySelector<HTMLDetailsElement>('[data-testid="ai-lab-agent-section"]');
    const advanced = root.querySelector<HTMLDetailsElement>('[data-testid="jarvis-lab-existing"]');
    const offline = root.querySelector<HTMLDetailsElement>('[data-testid="jarvis-lab-offline"]');
    expect(research?.open).toBe(true);
    expect(agent?.open).toBe(true);
    expect(advanced?.open).toBe(false);
    expect(offline?.open).toBe(false);
    expect(root.querySelector('.jarvis-lab-ux__overview')).toBeNull();
    expect(root.querySelector('.ai-lab-view__actions')).toBeNull();
    agent!.open = false;
    expect(research?.open).toBe(true);
    expect(agent?.open).toBe(false);
  });
});
