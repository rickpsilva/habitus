import type { TranslationKey } from './pt';

// Supported UI languages (mirrors the backend `supportedLanguages` contract).
export type Language = 'pt' | 'en';

export const SUPPORTED_LANGUAGES: Language[] = ['pt', 'en'];
export const DEFAULT_LANGUAGE: Language = 'pt';

// Native language names (endonyms) shown in the language switcher; scales as
// SUPPORTED_LANGUAGES grows. Keep keys in sync with the Language union.
export const LANGUAGE_ENDONYMS: Record<Language, string> = {
  pt: 'Português',
  en: 'English',
};

// Above this count the switcher shows a search box (type-ahead) instead of a plain list.
export const LANGUAGE_SEARCH_THRESHOLD = 5;

// Values allowed in `{placeholder}` interpolation.
export type TranslationParams = Record<string, string | number>;

// Translation function: resolves a key in the active language, falls back to
// Portuguese, and interpolates simple `{placeholder}` tokens.
export type TranslateFn = (key: TranslationKey, params?: TranslationParams) => string;

export interface I18nContextValue {
  language: Language;
  setLanguage: (language: Language) => void;
  t: TranslateFn;
}

export function isLanguage(value: unknown): value is Language {
  return value === 'pt' || value === 'en';
}

export type { TranslationKey };
