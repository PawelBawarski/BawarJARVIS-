import { DOCUMENT } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import {
  DEFAULT_LANGUAGE,
  Language,
  SUPPORTED_LANGUAGES,
  TranslationDictionary,
} from '../../../../public/i18n/language.model';

@Injectable({
  providedIn: 'root',
})
export class TranslationService {
  private readonly http = inject(HttpClient);
  private readonly document = inject(DOCUMENT);

  private readonly storageKey = 'jarvis.language';

  private readonly currentLanguage = signal<Language>(DEFAULT_LANGUAGE);

  private readonly dictionary = signal<TranslationDictionary>({});

  readonly language = this.currentLanguage.asReadonly();
  readonly loading = signal(false);

  async initialize(): Promise<void> {
    let saved: Language = DEFAULT_LANGUAGE;

    try {
      const value = this.document.defaultView?.localStorage.getItem(this.storageKey);

      if (SUPPORTED_LANGUAGES.some((lang) => lang === value)) {
        saved = value as Language;
      }
    } catch {
      // Korzystamy z języka domyślnego.
    }

    try {
      await this.setLanguage(saved);
    } catch (error) {
      console.error(`[JARVIS] Failed to load translations: ${saved}`, error);

      if (saved === DEFAULT_LANGUAGE) {
        throw error;
      }

      await this.setLanguage(DEFAULT_LANGUAGE);
    }
  }

  async setLanguage(language: Language): Promise<void> {
    if (this.loading()) {
      return;
    }

    this.loading.set(true);

    try {
      const response = await firstValueFrom(this.http.get<unknown>(`i18n/${language}.json`));

      if (!this.isDictionary(response)) {
        throw new Error(`Invalid translation file: ${language}`);
      }

      this.dictionary.set(response);
      this.currentLanguage.set(language);
      this.document.documentElement.lang = language;

      try {
        this.document.defaultView?.localStorage.setItem(this.storageKey, language);
      } catch {
        // Zapisywanie ustawień nie jest wymagane.
      }
    } finally {
      this.loading.set(false);
    }
  }

  translate(key: string): string {
    return this.dictionary()[key] ?? key;
  }

  private isDictionary(value: unknown): value is TranslationDictionary {
    return (
      typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value) &&
      Object.values(value).every((item) => typeof item === 'string')
    );
  }
}
