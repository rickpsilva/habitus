import type { Language } from './types';
import { LOCALE_BY_LANGUAGE } from './types';

// Accepted inputs for the date/time formatters. Strings/numbers are coerced
// through the Date constructor (ISO strings and epoch millis both work).
export type DateInput = Date | string | number;

function toDate(value: DateInput): Date {
  return value instanceof Date ? value : new Date(value);
}

// BCP-47 locale tag for the active UI language (e.g. pt -> pt-PT, en -> en-GB).
export function localeFor(language: Language): string {
  return LOCALE_BY_LANGUAGE[language];
}

// Date-only formatting. With no options this mirrors the previous
// `toLocaleDateString(locale)` default output for the active locale.
export function formatDate(
  value: DateInput,
  language: Language,
  options?: Intl.DateTimeFormatOptions,
): string {
  return toDate(value).toLocaleDateString(localeFor(language), options);
}

// Date + time formatting (previous `toLocaleString(locale)` behaviour).
export function formatDateTime(
  value: DateInput,
  language: Language,
  options?: Intl.DateTimeFormatOptions,
): string {
  return toDate(value).toLocaleString(localeFor(language), options);
}

// Time-only formatting (previous `toLocaleTimeString(locale)` behaviour).
export function formatTime(
  value: DateInput,
  language: Language,
  options?: Intl.DateTimeFormatOptions,
): string {
  return toDate(value).toLocaleTimeString(localeFor(language), options);
}

// Currency formatting; defaults to EUR to match the current fixed formatters.
export function formatCurrency(
  value: number,
  language: Language,
  options?: Intl.NumberFormatOptions,
): string {
  return new Intl.NumberFormat(localeFor(language), {
    style: 'currency',
    currency: 'EUR',
    ...options,
  }).format(value);
}
