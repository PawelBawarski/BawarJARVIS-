import { TestBed } from '@angular/core/testing';
import { ThemeService } from './theme';

describe('ThemeService', () => {
  beforeEach(() => {
    localStorage.removeItem('jarvis.theme');

    TestBed.configureTestingModule({});
  });

  afterEach(() => {
    localStorage.removeItem('jarvis.theme');
  });

  it('should create service', () => {
    const service = TestBed.inject(ThemeService);

    expect(service).toBeTruthy();
  });

  it('should use dark theme by default', () => {
    const service = TestBed.inject(ThemeService);

    expect(service.theme()).toBe('dark');
  });

  it('should toggle dark to light', () => {
    const service = TestBed.inject(ThemeService);

    service.toggleTheme();

    expect(service.theme()).toBe('light');
  });

  it('should save theme to localStorage', () => {
    const service = TestBed.inject(ThemeService);

    service.setTheme('light');

    expect(localStorage.getItem('jarvis.theme')).toBe('light');
  });

  it('should restore saved theme', () => {
    localStorage.setItem('jarvis.theme', 'light');

    const service = TestBed.inject(ThemeService);

    expect(service.theme()).toBe('light');
  });
});
