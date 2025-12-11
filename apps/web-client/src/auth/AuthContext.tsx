import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { createApiClient } from '../services/api';
import { authService } from '../services/auth';
import { getStoredToken, refreshAccessToken, setStoredToken } from '../services/token';
import { CurrentUser } from './types';

// Use identity service for IAM endpoints (with token refresh interceptor)
// In development, use proxy path to avoid cross-origin cookie issues
const IDENTITY_API_URL = import.meta.env.VITE_IDENTITY_API_URL ?? '/api/identity';
const identityApi = createApiClient(IDENTITY_API_URL);

interface AuthState {
  user: CurrentUser | null;
  loading: boolean;
  error: string | null;
}

const AuthContext = createContext<{
  auth: AuthState;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
  token?: string | null;
}>({
  auth: { user: null, loading: true, error: null },
  refresh: async () => {},
  logout: async () => {},
  token: null,
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [auth, setAuth] = useState<AuthState>({
    user: null,
    loading: true,
    error: null,
  });
  const [token, setToken] = useState<string | null>(getStoredToken());

  const refresh = useCallback(async () => {
    try {
      setAuth((prev) => ({ ...prev, loading: true, error: null }));
      const res = await identityApi.get('/iam/me');
      setAuth({ user: res.data, loading: false, error: null });
      setToken(getStoredToken());
    } catch (err: any) {
      setAuth({ user: null, loading: false, error: 'not_authenticated' });
      setToken(null);
    }
  }, []);

  // SECURITY: On page load, attempt silent refresh using HttpOnly cookie
  // This allows authentication to persist after page refresh without storing
  // tokens in localStorage (which is vulnerable to XSS)
  useEffect(() => {
    const initAuth = async () => {
      // Skip auth initialization on login page to make it load faster
      if (window.location.pathname === '/login') {
        setAuth({ user: null, loading: false, error: null });
        return;
      }

      // If we have a token in memory, try to use it
      if (getStoredToken()) {
        await refresh();
        return;
      }

      // No token in memory - try silent refresh via HttpOnly cookie
      try {
        const newToken = await refreshAccessToken();
        setStoredToken(newToken);
        setToken(newToken);
        await refresh();
      } catch {
        // Silent refresh failed - user needs to log in
        setAuth({ user: null, loading: false, error: 'not_authenticated' });
      }
    };

    void initAuth();
  }, [refresh]);

  return (
    <AuthContext.Provider value={{ auth, refresh, logout: authService.logout, token }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
