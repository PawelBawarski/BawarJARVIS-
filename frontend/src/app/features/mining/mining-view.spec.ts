import { Pipe, PipeTransform } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, beforeEach } from 'vitest';

import { MiningView } from './mining-view';
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

describe('MiningView', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MiningView],
    })
      .overrideComponent(MiningView, {
        remove: { imports: [TranslatePipe] },
        add: { imports: [MockTranslatePipe] },
      })
      .compileComponents();
  });

  it('should create component', () => {
    const fixture = TestBed.createComponent(MiningView);

    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should display mining information', () => {
    const fixture = TestBed.createComponent(MiningView);
    fixture.detectChanges();

    const element: HTMLElement = fixture.nativeElement;

    expect(element.querySelector('h2')?.textContent).toContain('mining.title');

    expect(element.querySelector('[role="status"]')?.textContent).toContain('mining.status');
  });
});
