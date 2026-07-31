/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { pt } from './pt';
import { en } from './en';
import { meApi, platformLocalizationApi } from '../api/services';
import { useAuth } from '../contexts/AuthContext';
import {
  DEFAULT_LANGUAGE,
  isLanguage,
  type I18nContextValue,
  type Language,
  type TranslateFn,
} from './types';

const dictionaries: Record<Language, Record<string, string>> = { pt, en };

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

// Reduces first-paint flash only: read the cached platform default (the app's
// baseline language) if valid, else Portuguese. The resolution effect below
// then corrects this to the authoritative value.
function resolveInitialLanguage(): Language {
  try {
    const cached = localStorage.getItem('platformDefaultLanguage');
    if (isLanguage(cached)) return cached;
  } catch {
    // Fall through to the default on any storage/parse error.
  }
  return DEFAULT_LANGUAGE;
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [language, setLanguageState] = useState<Language>(resolveInitialLanguage);

  const setLanguage = useCallback((next: Language) => {
    setLanguageState(next);
  }, []);

  // Resolve the authoritative language and react to login/logout/context switch.
  // Platform default is the baseline; a user's own choice only wins inside a
  // condominium context whose plan enables multilanguage (REQ-I18N-002).
  // setState runs only inside the async function (never synchronously in the
  // effect body) to stay lint-safe.
  const token = user?.token;
  useEffect(() => {
    async function resolve() {
      try {
        if (token) {
          const { data } = await meApi.getLocalization();
          const resolved =
            data.multilanguageEnabled && isLanguage(data.preferredLanguage)
              ? data.preferredLanguage
              : isLanguage(data.defaultLanguage)
                ? data.defaultLanguage
                : DEFAULT_LANGUAGE;
          if (isLanguage(data.defaultLanguage)) {
            localStorage.setItem('platformDefaultLanguage', data.defaultLanguage);
          }
          setLanguageState(resolved);
        } else {
          const { data } = await platformLocalizationApi.getPublicDefault();
          const resolved = isLanguage(data.defaultLanguage) ? data.defaultLanguage : DEFAULT_LANGUAGE;
          localStorage.setItem('platformDefaultLanguage', resolved);
          setLanguageState(resolved);
        }
      } catch {
        // Keep the current/lazy language on any failure; never throw.
      }
    }
    resolve();
  }, [token]);

  const t = useCallback<TranslateFn>(
    (key, params) => {
      // Active language → Portuguese fallback → raw key (never blank).
      const template = dictionaries[language][key] ?? pt[key] ?? key;
      if (!params) return template;
      return template.replace(/\{(\w+)\}/g, (match, token: string) =>
        token in params ? String(params[token]) : match,
      );
    },
    [language],
  );

  // Keep the document language in sync (accessibility). This only touches the
  // DOM, not React state, so it is safe inside an effect.
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  return (
    <I18nContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useTranslation(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) throw new Error('useTranslation must be used within I18nProvider');
  return context;
}
