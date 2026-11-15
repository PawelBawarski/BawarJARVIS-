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

  it('renders only three collapsed AI Lab areas', () => {
    const fixture = TestBed.createComponent(AiLabView);
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;
    const sections = root.querySelectorAll<HTMLDetailsElement>('.jarvis-lab-ux > details');
    expect(sections.length).toBe(3);
    expect([...sections].every(section => !section.open)).toBe(true);
    expect(root.querySelector('[data-testid="jarvis-lab-offline"]')).toBeNull();
    expect(root.querySelector('app-ai-training-panel')).toBeNull();
    expect(root.querySelector('app-lora-training')).toBeNull(); // lazy until user opens training
    const training = root.querySelector<HTMLDetailsElement>('[data-testid="ai-lab-training-section"]')!;
    training.open = true;
    training.dispatchEvent(new Event('toggle'));
    fixture.detectChanges();
    expect(root.querySelector('app-lora-training')).not.toBeNull();
    expect(root.querySelector('app-lora-evidence')).not.toBeNull();
  });
});
