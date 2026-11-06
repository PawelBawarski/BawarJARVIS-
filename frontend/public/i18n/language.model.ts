
export const SUPPORTED_LANGUAGES = ['pl', 'en'] as const;

export type Language =
  (typeof SUPPORTED_LANGUAGES)[number];

export const DEFAULT_LANGUAGE: Language = 'pl';

export type TranslationDictionary =
  Record<string, string>;