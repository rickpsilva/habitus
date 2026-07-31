/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState } from 'react';
import type { AuthResponse } from '../types';
import { UserRole } from '../types';
import { meApi } from '../api/services';
import { pt } from '../i18n/pt';
import { en } from '../i18n/en';
import { DEFAULT_LANGUAGE, isLanguage, type Language, type TranslationKey } from '../i18n/types';

const dictionaries: Record<Language, Record<string, string>> = { pt, en };

// AuthProvider is the outermost provider (I18nProvider is its descendant, since
// I18nProvider consumes useAuth), so the useTranslation hook is unreachable
// here. Resolve user-facing messages against the shared dictionaries using the
// same cached UI-language signal the i18n provider uses for first paint.
function tAuth(key: TranslationKey): string {
  let language: Language = DEFAULT_LANGUAGE;
  try {
    const cached = localStorage.getItem('platformDefaultLanguage');
    if (isLanguage(cached)) language = cached;
  } catch {
    // Ignore storage errors and fall back to the default language.
  }
  return dictionaries[language][key] ?? pt[key] ?? key;
}

interface AuthContextType {
  user: AuthResponse | null;
  login: (user: AuthResponse) => void;
  logout: () => void;
  switchContext: (condominiumId: string, unitId?: string | null) => Promise<AuthResponse>;
  isManager: boolean;
  isAdmin: boolean;
  isResident: boolean;
  condominiumId: string | null;
  unitId: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthResponse | null>(() => {
    const stored = localStorage.getItem('user');
    if (!stored) return null;
    try {
      return JSON.parse(stored) as AuthResponse;
    } catch {
      // Corrupted persisted session: treat as logged-out and clear bad keys.
      localStorage.removeItem('user');
      localStorage.removeItem('token');
      return null;
    }
  });

  const login = (userData: AuthResponse) => {
    localStorage.setItem('token', userData.token);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  // Switches the active condominium/unit context without a full re-login.
  // On success the returned token + user fields replace the stored session
  // (same persistence path as login). On failure the existing session is
  // left untouched and a localized (PT) message is thrown for the caller.
  const switchContext = async (condominiumId: string, unitId?: string | null) => {
    try {
      const { data } = await meApi.setActiveContext({ condominiumId, unitId: unitId ?? null });
      login(data);
      return data;
    } catch (err) {
      const status = (err as { response?: { status?: number } }).response?.status;
      if (status === 403) {
        throw new Error(tAuth('auth.error.noAccess'));
      }
      if (status === 423) {
        throw new Error(tAuth('auth.error.inactiveCondominium'));
      }
      throw new Error(tAuth('auth.error.switchFailed'));
    }
  };

  const isManager = user?.role === UserRole.Manager;
  const isAdmin = user?.role === UserRole.Admin;
  const isResident = user?.role === UserRole.Resident;
  const condominiumId = user?.condominiumId || null;
  const unitId = user?.unitId || null;

  return (
    <AuthContext.Provider value={{ 
      user, 
      login, 
      logout, 
      switchContext,
      isManager, 
      isAdmin, 
      isResident,
      condominiumId,
      unitId
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
