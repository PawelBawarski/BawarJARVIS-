
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AppShell } from './app-shell';

describe('AppShell', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient()]
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should render sidebar and chat', async () => {
    const fixture = TestBed.createComponent(AppShell);
    await fixture.whenStable();

    const element = fixture.nativeElement;

    expect(element.querySelector('app-sidebar'))
      .not.toBeNull();

    expect(element.querySelector('app-chat-view'))
      .not.toBeNull();
  });

  it('should toggle sidebar', async () => {
    const fixture = TestBed.createComponent(AppShell);
    const component = fixture.componentInstance;

    await fixture.whenStable();

    expect(component.sidebarOpen()).toBe(true);

    const button: HTMLButtonElement =
      fixture.nativeElement.querySelector('.menu-toggle');

    button.click();
    await fixture.whenStable();

    expect(component.sidebarOpen()).toBe(false);
    expect(button.getAttribute('aria-expanded'))
      .toBe('false');

    button.click();
    await fixture.whenStable();

    expect(component.sidebarOpen()).toBe(true);
  });

  it('should use an overlay on small screens', async () => {
    vi.stubGlobal('matchMedia', () => ({
      matches: true,
      addEventListener: () => {},
      removeEventListener: () => {}
    }));

    const fixture = TestBed.createComponent(AppShell);
    const component = fixture.componentInstance;

    await fixture.whenStable();

    expect(component.isMobile()).toBe(true);
    expect(component.sidebarOpen()).toBe(false);

    const menu: HTMLButtonElement =
      fixture.nativeElement.querySelector('.menu-toggle');

    menu.click();
    await fixture.whenStable();

    expect(component.sidebarOpen()).toBe(true);

    const backdrop: HTMLButtonElement =
      fixture.nativeElement.querySelector(
        '.sidebar-backdrop'
      );

    expect(backdrop).not.toBeNull();

    backdrop.click();
    await fixture.whenStable();

    expect(component.sidebarOpen()).toBe(false);
  });
});
