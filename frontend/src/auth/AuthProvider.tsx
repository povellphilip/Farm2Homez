import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, ensureCsrfCookie, onSessionExpired, refreshSession, setAccessToken } from '@/api/client';
import type { Role, Session, User } from '@/api/types';

type Status = 'loading' | 'authenticated' | 'anonymous';

interface AuthContextValue {
  status: Status;
  user: User | null;
  login: (email: string, password: string, role: Role) => Promise<User>;
  logout: () => Promise<void>;
  /** Replace the session after an endpoint that returns new tokens (e.g. password change). */
  applySession: (session: Session) => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<Status>('loading');
  const [user, setUser] = useState<User | null>(null);

  const clear = useCallback(() => {
    setAccessToken(null);
    setUser(null);
    setStatus('anonymous');
    queryClient.removeQueries({ predicate: (query) => query.queryKey[0] === 'me' });
  }, [queryClient]);

  const applySession = useCallback((session: Session) => {
    setAccessToken(session.access);
    setUser(session.user);
    setStatus('authenticated');
  }, []);

  // Restore the session from the refresh cookie on first load.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = await refreshSession();
      if (cancelled) return;
      if (!token) return clear();
      try {
        const { data } = await api.get<User>('/auth/me/');
        if (!cancelled) {
          setUser(data);
          setStatus('authenticated');
        }
      } catch {
        if (!cancelled) clear();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clear]);

  useEffect(() => {
    onSessionExpired(clear);
  }, [clear]);

  const login = useCallback(
    async (email: string, password: string, role: Role) => {
      await ensureCsrfCookie();
      const { data } = await api.post<Session>('/auth/login/', { email, password, role });
      queryClient.clear();
      applySession(data);
      return data.user;
    },
    [applySession, queryClient],
  );

  const logout = useCallback(async () => {
    try {
      await ensureCsrfCookie();
      await api.post('/auth/logout/');
    } finally {
      queryClient.clear();
      clear();
    }
  }, [clear, queryClient]);

  const refreshUser = useCallback(async () => {
    const { data } = await api.get<User>('/auth/me/');
    setUser(data);
  }, []);

  const value = useMemo(
    () => ({ status, user, login, logout, applySession, refreshUser }),
    [status, user, login, logout, applySession, refreshUser],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}

export const PORTAL_HOME: Record<Role, string> = {
  CONSUMER: '/consumer/dashboard',
  PRODUCER: '/producer/dashboard',
  ADMIN: '/admin/dashboard',
};

export const PORTAL_LOGIN: Record<Role, string> = {
  CONSUMER: '/consumer/login',
  PRODUCER: '/producer/login',
  ADMIN: '/admin/login',
};
