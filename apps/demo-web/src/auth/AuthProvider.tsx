import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { apiRequest, setCsrfToken } from '../api/client';
import type { AuthIdentity, DataResponse, LoginPayload, LoginResponse } from '../api/contracts';

interface AuthContextValue {
  readonly user: AuthIdentity | null;
  readonly loading: boolean;
  readonly login: (payload: LoginPayload) => Promise<void>;
  readonly logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { readonly children: ReactNode }): ReactNode {
  const [user, setUser] = useState<AuthIdentity | null>(null);
  const [loading, setLoading] = useState(true);

  const clear = useCallback((): void => {
    setUser(null);
    setCsrfToken(null);
  }, []);

  const loadIdentity = useCallback(async (): Promise<void> => {
    try {
      const response = await apiRequest<DataResponse<AuthIdentity>>('/auth/me');
      setUser(response.data);
    } catch {
      clear();
    } finally {
      setLoading(false);
    }
  }, [clear]);

  useEffect(() => {
    void loadIdentity();
    window.addEventListener('fem:unauthorized', clear);
    return (): void => window.removeEventListener('fem:unauthorized', clear);
  }, [clear, loadIdentity]);

  const login = useCallback(async (payload: LoginPayload): Promise<void> => {
    const response = await apiRequest<LoginResponse>('/auth/login', {
      method: 'POST',
      body: payload,
    });
    setCsrfToken(response.data.csrfToken);
    const identity = await apiRequest<DataResponse<AuthIdentity>>('/auth/me');
    setUser(identity.data);
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    try {
      await apiRequest<void>('/auth/logout', { method: 'POST' });
    } finally {
      clear();
    }
  }, [clear]);

  const value = useMemo(() => ({ user, loading, login, logout }), [loading, login, logout, user]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
