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
  private readonly version = signal(0);
  private readonly cache = new Map<Language, TranslationDictionary>();

  readonly language = this.currentLanguage.asReadonly();
  /** Changes only when the active dictionary changes; allows pipes to skip repeat lookups. */
  readonly dictionaryVersion = this.version.asReadonly();
  readonly loading = signal(false);
  private latestRequestId = 0;

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

  /** Latest language request wins. Already validated dictionaries are reused without HTTP. */
  async setLanguage(language: Language): Promise<void> {
    if (!SUPPORTED_LANGUAGES.includes(language)) {
      throw new Error(`Unsupported language: ${language}`);
    }
    const requestId = ++this.latestRequestId;
    this.loading.set(true);

    try {
      let next = this.cache.get(language);
      if (!next) {
        const response = await firstValueFrom(this.http.get<unknown>(`i18n/${language}.json`));
        if (requestId !== this.latestRequestId) return;
        if (!this.isDictionary(response)) throw new Error(`Invalid translation file: ${language}`);
        this.cache.set(language, response);
        next = response;
      }
      if (requestId !== this.latestRequestId) return;
      if (this.dictionary() !== next) {
        this.dictionary.set(next);
        this.version.update((value) => value + 1);
      }
      this.currentLanguage.set(language);
      this.document.documentElement.lang = language;

      try {
        this.document.defaultView?.localStorage.setItem(this.storageKey, language);
      } catch {
        // Language preference only; chat and project data never go to localStorage.
      }
    } catch (error) {
      if (requestId === this.latestRequestId) throw error;
    } finally {
      if (requestId === this.latestRequestId) this.loading.set(false);
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
