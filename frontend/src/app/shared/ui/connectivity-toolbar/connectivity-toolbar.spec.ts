import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { signal } from '@angular/core';
import { ConnectivityToolbar } from './connectivity-toolbar';
import { NetworkStatusService } from '../../../core/services/network-status';

describe('ConnectivityToolbar', () => {
  const status = signal<'online' | 'offline' | 'unverified'>('offline');
  const fakeService = {
    status,
    isOffline: () => status() === 'offline',
    refresh: vi.fn(),
  };

  beforeEach(async () => {
    status.set('offline');
    await TestBed.configureTestingModule({
      imports: [ConnectivityToolbar],
      providers: [
        provideHttpClient(),
        { provide: NetworkStatusService, useValue: fakeService },
      ],
    }).compileComponents();
  });

  afterEach(() => TestBed.resetTestingModule());

  it('renders an accessible clickable offline indicator', () => {
    const fixture = TestBed.createComponent(ConnectivityToolbar);
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    const indicator = element.querySelector('[data-testid="network-state"]');
    expect(indicator?.tagName).toBe('BUTTON');
    expect(indicator?.classList.contains('connectivity-toolbar__indicator--offline')).toBe(true);
    expect(element.querySelectorAll('button').length).toBe(1);
  });

  it('checks connectivity after clicking the indicator', async () => {
    fakeService.refresh.mockClear();
    const fixture = TestBed.createComponent(ConnectivityToolbar);
    fixture.detectChanges();
    const button: HTMLButtonElement = fixture.nativeElement.querySelector('[data-testid="network-state"]');
    button.click();
    await fixture.whenStable();
    expect(fakeService.refresh).toHaveBeenCalled();
  });

  it('changes visual state when online', () => {
    status.set('online');
    const fixture = TestBed.createComponent(ConnectivityToolbar);
    fixture.detectChanges();
    const indicator = (fixture.nativeElement as HTMLElement).querySelector('[data-testid="network-state"]');
    expect(indicator?.classList.contains('connectivity-toolbar__indicator--online')).toBe(true);
    expect(indicator?.classList.contains('connectivity-toolbar__indicator--offline')).toBe(false);
  });

  it('does not incorrectly classify unverified as offline', () => {
    status.set('unverified');
    const fixture = TestBed.createComponent(ConnectivityToolbar);
    fixture.detectChanges();
    const indicator = (fixture.nativeElement as HTMLElement).querySelector('[data-testid="network-state"]');
    expect(indicator?.classList.contains('connectivity-toolbar__indicator--offline')).toBe(false);
    expect(indicator?.textContent).toContain('?');
  });
});
