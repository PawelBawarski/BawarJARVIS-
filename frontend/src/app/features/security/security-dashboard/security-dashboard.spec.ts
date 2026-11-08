import { Pipe, PipeTransform, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SecurityDashboard } from './security-dashboard';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import {
  BackendStatus,
  SecurityDiagnosticsService,
} from '../../../core/services/security-diagnostics';

@Pipe({ name: 'translate' })
class MockTranslatePipe implements PipeTransform {
  transform(key: string): string {
    return key;
  }
}

describe('SecurityDashboard', () => {
  const backendStatus = signal<BackendStatus>('checking');
  const checkBackend = vi.fn().mockResolvedValue(undefined);

  beforeEach(async () => {
    backendStatus.set('checking');
    checkBackend.mockClear();

    await TestBed.configureTestingModule({
      imports: [SecurityDashboard],
      providers: [
        {
          provide: SecurityDiagnosticsService,
          useValue: { backendStatus, checkBackend },
        },
      ],
    })
      .overrideComponent(SecurityDashboard, {
        remove: { imports: [TranslatePipe] },
        add: { imports: [MockTranslatePipe] },
      })
      .compileComponents();
  });

  it('should display four security checks', () => {
    const fixture = TestBed.createComponent(SecurityDashboard);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.security-card')).toHaveLength(4);
    expect(checkBackend).toHaveBeenCalledOnce();
  });

  it('should keep other checks unverified', () => {
    const fixture = TestBed.createComponent(SecurityDashboard);
    fixture.detectChanges();

    const cards: NodeListOf<HTMLElement> =
      fixture.nativeElement.querySelectorAll('.security-card');

    expect(cards[1].textContent).toContain('security.unverified');
    expect(cards[2].textContent).toContain('security.unverified');
    expect(cards[3].textContent).toContain('security.unverified');
  });

  it('should show authenticated status only for backend', () => {
    backendStatus.set('authenticated');
    const fixture = TestBed.createComponent(SecurityDashboard);
    fixture.detectChanges();

    const firstCard: HTMLElement =
      fixture.nativeElement.querySelector('.security-card');
    expect(firstCard.textContent).toContain('security.authenticated');
    expect(firstCard.querySelector('.security-card__status--authenticated')).not.toBeNull();
  });
});
