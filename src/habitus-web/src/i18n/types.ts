import type { TranslationKey } from './pt';

// Supported UI languages (mirrors the backend `supportedLanguages` contract).
export type Language = 'pt' | 'en';

export const SUPPORTED_LANGUAGES: Language[] = ['pt', 'en'];
export const DEFAULT_LANGUAGE: Language = 'pt';

// BCP-47 locale tags used for date/number formatting per UI language. English
// uses en-GB (day/month/year, € grouping) to match this European app's layout.
export const LOCALE_BY_LANGUAGE: Record<Language, string> = {
  pt: 'pt-PT',
  en: 'en-GB',
};

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

// Inputs accepted by the locale-aware date/time formatters exposed on the context.
export type DateInput = Date | string | number;

export interface I18nContextValue {
  language: Language;
  setLanguage: (language: Language) => void;
  t: TranslateFn;
  // Locale-aware formatters bound to the active language (see i18n/format.ts).
  formatDate: (value: DateInput, options?: Intl.DateTimeFormatOptions) => string;
  formatDateTime: (value: DateInput, options?: Intl.DateTimeFormatOptions) => string;
  formatTime: (value: DateInput, options?: Intl.DateTimeFormatOptions) => string;
  formatCurrency: (value: number, options?: Intl.NumberFormatOptions) => string;
}

export function isLanguage(value: unknown): value is Language {
  return value === 'pt' || value === 'en';
}

export type { TranslationKey };
