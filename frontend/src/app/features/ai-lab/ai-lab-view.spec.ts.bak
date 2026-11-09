import { Pipe, PipeTransform } from '@angular/core';
import { TestBed } from '@angular/core/testing';
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

  it('should display stopped status', () => {
    const fixture = TestBed.createComponent(AiLabView);
    fixture.detectChanges();

    const element: HTMLElement = fixture.nativeElement;

    expect(element.querySelector('[role="status"]')?.textContent).toContain('lab.status');
  });

  it('should keep agent controls disabled', () => {
    const fixture = TestBed.createComponent(AiLabView);
    fixture.detectChanges();

    const buttons = fixture.nativeElement.querySelectorAll(
      'button',
    ) as NodeListOf<HTMLButtonElement>;

    expect(buttons.length).toBe(2);
    expect(buttons[0].disabled).toBe(true);
    expect(buttons[1].disabled).toBe(true);
  });
});
