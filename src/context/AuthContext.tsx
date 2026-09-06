'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, ApiError, setAuthToken } from '@/lib/client/api';
import { connectSocket, disconnectSocket } from '@/lib/client/socket';
import type { AuthResponse, User, Wallet } from '@/lib/client/types';

interface AuthContextValue {
  user: User | null;
  token: string | null;
  wallet: Wallet | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => void;
  refreshWallet: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const STORAGE_KEY = 'auction-game-session';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [loading, setLoading] = useState(true);

  const applySession = useCallback((session: AuthResponse) => {
    setAuthToken(session.accessToken);
    setUser(session.user);
    setToken(session.accessToken);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    connectSocket(session.accessToken);
  }, []);

  const refreshWallet = useCallback(async () => {
    try {
      const w = await api.get<Wallet>('/wallet/me');
      setWallet(w);
    } catch {
      // ignore — likely logged out mid-flight
    }
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const session: AuthResponse = JSON.parse(stored);
        applySession(session);
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    setLoading(false);
  }, [applySession]);

  useEffect(() => {
    if (token) {
      refreshWallet();
    }
  }, [token, refreshWallet]);

  const login = useCallback(
    async (email: string, password: string) => {
      const session = await api.post<AuthResponse>('/auth/login', { email, password });
      applySession(session);
    },
    [applySession],
  );

  const register = useCallback(
    async (email: string, password: string, displayName: string) => {
      const session = await api.post<AuthResponse>('/auth/register', { email, password, displayName });
      applySession(session);
    },
    [applySession],
  );

  const logout = useCallback(() => {
    setAuthToken(null);
    setUser(null);
    setToken(null);
    setWallet(null);
    localStorage.removeItem(STORAGE_KEY);
    disconnectSocket();
  }, []);

  const value = useMemo(
    () => ({ user, token, wallet, loading, login, register, logout, refreshWallet }),
    [user, token, wallet, loading, login, register, logout, refreshWallet],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export { ApiError };
