import { Pipe, PipeTransform } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { SecurityDashboard } from './security-dashboard';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';

@Pipe({
  name: 'translate',
})
class MockTranslatePipe implements PipeTransform {
  transform(key: string): string {
    return key;
  }
}

describe('SecurityDashboard', () => {
  it('should display four security checks', async () => {
    await TestBed.configureTestingModule({
      imports: [SecurityDashboard],
    })
      .overrideComponent(SecurityDashboard, {
        remove: { imports: [TranslatePipe] },
        add: { imports: [MockTranslatePipe] },
      })
      .compileComponents();

    const fixture = TestBed.createComponent(SecurityDashboard);

    await fixture.whenStable();

    const cards = fixture.nativeElement.querySelectorAll('.security-card');

    expect(cards.length).toBe(4);
  });

  it('should not claim checks are verified', () => {
    const component = new SecurityDashboard();

    expect(component.checks.every((check) => check.status === 'unverified')).toBe(true);
  });
});
