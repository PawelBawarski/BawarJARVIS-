
import { DOCUMENT } from '@angular/common';
import { inject, Injectable, signal } from '@angular/core';

export type Theme = 'dark' | 'light';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly storageKey = 'jarvis.theme';

  private readonly currentTheme =
    signal<Theme>(this.loadTheme());

  readonly theme = this.currentTheme.asReadonly();

  constructor() {
    this.applyTheme(this.currentTheme());
  }

  toggleTheme(): void {
    const nextTheme: Theme =
      this.currentTheme() === 'dark' ? 'light' : 'dark';

    this.setTheme(nextTheme);
  }

  setTheme(theme: Theme): void {
    this.currentTheme.set(theme);
    this.applyTheme(theme);

    try {
      this.document.defaultView?.localStorage.setItem(
        this.storageKey,
        theme
      );
    } catch {
      // Aplikacja działa nawet bez localStorage.
    }
  }

  private applyTheme(theme: Theme): void {
    this.document.documentElement.setAttribute(
      'data-theme',
      theme
    );
  }

  private loadTheme(): Theme {
    try {
      const saved =
        this.document.defaultView?.localStorage.getItem(
          this.storageKey
        );

      return saved === 'light' ? 'light' : 'dark';
    } catch {
      return 'dark';
    }
  }
}
