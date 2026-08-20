/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect } from 'react';
import type { AuthResponse, ImpersonationStatusResponse } from '../types';
import { UserRole } from '../types';
import { meApi, authApi } from '../api/services';
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

interface ImpersonationState {
  isImpersonating: boolean;
  impersonatedUserId: string | null;
  impersonatedUserName: string | null;
  impersonatedRole: number | null;
  condominiumId: string | null;
  condominiumName: string | null;
  unitId: string | null;
  unitIdentifier: string | null;
  expiresAt: string | null;
  impersonatorUserId: string | null;
  impersonatorUserName: string | null;
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
  // Impersonation
  impersonation: ImpersonationState;
  startImpersonation: (targetUserId: string, unitId?: string | null) => Promise<ImpersonationStatusResponse>;
  endImpersonation: () => Promise<AuthResponse>;
  refreshImpersonationStatus: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function getInitialImpersonationState(): ImpersonationState {
  return {
    isImpersonating: false,
    impersonatedUserId: null,
    impersonatedUserName: null,
    impersonatedRole: null,
    condominiumId: null,
    condominiumName: null,
    unitId: null,
    unitIdentifier: null,
    expiresAt: null,
    impersonatorUserId: null,
    impersonatorUserName: null,
  };
}

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

  const [impersonation, setImpersonation] = useState<ImpersonationState>(() => {
    const stored = localStorage.getItem('impersonation');
    if (!stored) return getInitialImpersonationState();
    try {
      return JSON.parse(stored) as ImpersonationState;
    } catch {
      localStorage.removeItem('impersonation');
      return getInitialImpersonationState();
    }
  });

  // Sync impersonation state to localStorage
  useEffect(() => {
    if (impersonation.isImpersonating) {
      localStorage.setItem('impersonation', JSON.stringify(impersonation));
    } else {
      localStorage.removeItem('impersonation');
    }
  }, [impersonation]);

  const login = (userData: AuthResponse) => {
    localStorage.setItem('token', userData.token);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('impersonation');
    setUser(null);
    setImpersonation(getInitialImpersonationState());
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

  // Start impersonation session
  const startImpersonation = async (targetUserId: string, unitId?: string | null) => {
    try {
      const { data } = await authApi.startImpersonation({ targetUserId, unitId: unitId ?? undefined });
      // Store the impersonation token as the current auth token
      // Preserve the original Manager's ID for the impersonator reference
      login({
        id: user!.id,
        token: data.token,
        email: data.impersonatedUserName + '@impersonated', // placeholder, actual email in token
        name: data.impersonatedUserName,
        role: data.impersonatedRole as UserRole,
        condominiumId: data.condominiumId,
        unitId: data.unitId ?? undefined,
      });
      // Update impersonation state
      const newImpersonationState: ImpersonationState = {
        isImpersonating: true,
        impersonatedUserId: data.impersonatedUserId.toString(),
        impersonatedUserName: data.impersonatedUserName,
        impersonatedRole: data.impersonatedRole,
        condominiumId: data.condominiumId.toString(),
        condominiumName: data.condominiumName ?? null,
        unitId: data.unitId?.toString() ?? null,
        unitIdentifier: data.unitIdentifier ?? null,
        expiresAt: data.expiresAt.toString(), // Unix timestamp from backend
        impersonatorUserId: user?.id ?? null,
        impersonatorUserName: user?.name ?? null,
      };
      setImpersonation(newImpersonationState);
      return newImpersonationState as unknown as ImpersonationStatusResponse;
    } catch (err) {
      const status = (err as { response?: { status?: number } }).response?.status;
      if (status === 403) {
        throw new Error(tAuth('auth.error.noAccess'));
      }
      throw new Error(tAuth('auth.error.impersonationFailed') || 'Failed to start impersonation');
    }
  };

  // End impersonation session
  const endImpersonation = async () => {
    try {
      const { data } = await authApi.endImpersonation();
      login(data);
      setImpersonation(getInitialImpersonationState());
      return data;
    } catch (err) {
      const status = (err as { response?: { status?: number } }).response?.status;
      if (status === 400) {
        throw new Error(tAuth('auth.error.notImpersonating'));
      }
      throw new Error(tAuth('auth.error.impersonationEndFailed') || 'Failed to end impersonation');
    }
  };

  // Refresh impersonation status from server
  const refreshImpersonationStatus = async () => {
    try {
      const { data } = await authApi.getImpersonationStatus();
      if (!data.isImpersonating) {
        setImpersonation(getInitialImpersonationState());
        return;
      }
      setImpersonation({
        isImpersonating: true,
        impersonatedUserId: data.impersonatedUserId?.toString() ?? null,
        impersonatedUserName: data.impersonatedUserName ?? null,
        impersonatedRole: data.impersonatedRole ?? null,
        condominiumId: data.condominiumId?.toString() ?? null,
        condominiumName: data.condominiumName ?? null,
        unitId: data.unitId?.toString() ?? null,
        unitIdentifier: data.unitIdentifier ?? null,
        expiresAt: data.expiresAt?.toString() ?? null, // Unix timestamp from backend
        impersonatorUserId: data.impersonatorUserId?.toString() ?? null,
        impersonatorUserName: data.impersonatorUserName ?? null,
      });
    } catch {
      // If status check fails, assume not impersonating
      setImpersonation(getInitialImpersonationState());
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
      unitId,
      impersonation,
      startImpersonation,
      endImpersonation,
      refreshImpersonationStatus,
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
