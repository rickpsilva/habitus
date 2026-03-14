import React, { createContext, useContext, useState, useEffect } from 'react';
import type { AuthResponse } from '../types';

interface AuthContextType {
  user: AuthResponse | null;
  login: (user: AuthResponse) => void;
  logout: () => void;
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
    return stored ? JSON.parse(stored) : null;
  });

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (stored) setUser(JSON.parse(stored));
  }, []);

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

  const isManager = user?.role === 0;
  const isAdmin = user?.role === 1;
  const isResident = user?.role === 2;
  const condominiumId = user?.condominiumId || null;
  const unitId = user?.unitId || null;

  return (
    <AuthContext.Provider value={{ 
      user, 
      login, 
      logout, 
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
