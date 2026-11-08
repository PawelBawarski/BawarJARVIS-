import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { signal } from '@angular/core';
import { ConnectivityToolbar } from './connectivity-toolbar';
import { NetworkStatusService } from '../../../core/services/network-status';

describe('ConnectivityToolbar', () => {
  const status = signal<'online' | 'offline' | 'unverified'>('offline');
  const fakeService = { status, isOffline: () => status() === 'offline', refresh: vi.fn() };

  beforeEach(async () => {
    status.set('offline');
    await TestBed.configureTestingModule({
      imports: [ConnectivityToolbar],
      providers: [provideHttpClient(), { provide: NetworkStatusService, useValue: fakeService }],
    }).compileComponents();
  });
  afterEach(() => TestBed.resetTestingModule());

  it('disables internet-dependent actions when offline', () => {
    const fixture = TestBed.createComponent(ConnectivityToolbar);
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    expect((element.querySelector('[data-testid="install-link"]') as HTMLButtonElement).disabled).toBe(true);
    expect((element.querySelector('[data-testid="browser-link"]') as HTMLButtonElement).disabled).toBe(true);
  });

  it('enables release and browser links once online', () => {
    status.set('online');
    const fixture = TestBed.createComponent(ConnectivityToolbar);
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    expect((element.querySelector('[data-testid="install-link"]') as HTMLButtonElement).disabled).toBe(false);
    expect((element.querySelector('[data-testid="browser-link"]') as HTMLButtonElement).disabled).toBe(false);
  });
});
