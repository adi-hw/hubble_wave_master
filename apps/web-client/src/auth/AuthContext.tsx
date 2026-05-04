import {
  createContext,
  useContext,
  ReactNode,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import { authService, User } from '../services/auth';
import {
  getStoredToken,
  setStoredToken,
  clearAllTokens,
  refreshAccessToken,
} from '../services/token';
import { sendMessageToSW } from '../lib/sw-register';

// localStorage key written by services/token.ts for legacy cleanup, and used
// by the cross-tab logout listener below to detect when another tab cleared
// the session.
const LEGACY_TOKEN_STORAGE_KEY = 'accessToken';

// ============================================================================
// Types
// ============================================================================

export interface AuthState {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  error: string | null;
  mfaRequired: boolean;
  mfaSessionToken: string | null;
}

export interface LoginCredentials {
  username: string;
  password: string;
  rememberMe?: boolean;
  mfaToken?: string;
}

export interface MfaVerifyPayload {
  code: string;
  mfaSessionToken: string;
  useBackupCode?: boolean;
}

export interface AuthContextType {
  // State
  auth: AuthState;
  token: string | null;

  // Authentication actions
  login: (credentials: LoginCredentials) => Promise<LoginResult>;
  verifyMfa: (payload: MfaVerifyPayload) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  refreshUser: () => Promise<void>;

  // Session management
  getSessions: () => Promise<Session[]>;
  revokeSession: (sessionId: string) => Promise<void>;
  revokeOtherSessions: () => Promise<number>;

  // MFA management
  getMfaStatus: () => Promise<MfaStatus>;
  enrollMfa: () => Promise<MfaEnrollment>;
  verifyMfaEnrollment: (code: string) => Promise<string[]>;
  disableMfa: () => Promise<void>;

  // Password management
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;

  // Helpers
  hasRole: (role: string) => boolean;
  hasPermission: (permission: string) => boolean;
  hasAnyRole: (roles: string[]) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
}

export interface LoginResult {
  success: boolean;
  mfaRequired?: boolean;
  mfaSessionToken?: string;
  passwordExpired?: boolean;
  userId?: string;
  error?: string;
}

export interface Session {
  id: string;
  deviceType?: string;
  deviceName?: string;
  browserName?: string;
  osName?: string;
  ipAddress: string;
  country?: string;
  city?: string;
  lastActivityAt: Date;
  createdAt: Date;
  isActive: boolean;
  isCurrent: boolean;
  mfaVerified: boolean;
  authMethod: string;
}

export interface MfaStatus {
  enabled: boolean;
  methods: string[];
}

export interface MfaEnrollment {
  secret: string;
  qrCodeDataUrl: string;
  recoveryCodes: string[];
}

// ============================================================================
// Context
// ============================================================================

const AuthContext = createContext<AuthContextType | null>(null);

// ============================================================================
// Provider Component
// ============================================================================

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [auth, setAuth] = useState<AuthState>({
    user: null,
    loading: true,
    isAuthenticated: false,
    error: null,
    mfaRequired: false,
    mfaSessionToken: null,
  });

  const [token, setToken] = useState<string | null>(getStoredToken());

  // API base URL
  const apiUrl = import.meta.env.VITE_IDENTITY_API_URL ?? '/api/identity';

  // =========================================================================
  // Authentication Actions
  // =========================================================================

  const login = useCallback(
    async (credentials: LoginCredentials): Promise<LoginResult> => {
      setAuth((prev) => ({ ...prev, loading: true, error: null }));

      try {
        // POST /auth/login is intentionally exempt from the platform CSRF
        // middleware (svc-identity CsrfMiddleware exemptPatterns). The login
        // endpoint is rate-limited and is the request that *creates* the
        // session — there is no pre-existing authenticated context to forge,
        // so the double-submit token cannot meaningfully protect it. The
        // attacks CSRF guards against (silent state changes from third-party
        // origins) are addressed here by SameSite=Strict refresh cookies plus
        // server-side throttling. Other state-changing endpoints continue to
        // require the X-XSRF-TOKEN header (set by createApiClient).
        const response = await authService.login(
          credentials.username,
          credentials.password,
          credentials.rememberMe,
          credentials.mfaToken
        );

        // Check if MFA is required
        if ((response as any).mfaRequired) {
          setAuth((prev) => ({
            ...prev,
            loading: false,
            mfaRequired: true,
            mfaSessionToken: (response as any).mfaSessionToken,
          }));
          return {
            success: false,
            mfaRequired: true,
            mfaSessionToken: (response as any).mfaSessionToken,
          };
        }

        // Check if password has expired
        if ((response as any).passwordExpired) {
          setAuth((prev) => ({
            ...prev,
            loading: false,
          }));
          return {
            success: false,
            passwordExpired: true,
            userId: (response as any).userId,
            error: (response as any).message || 'Password has expired. Please change your password.',
          };
        }

        setStoredToken(response.accessToken);
        setToken(response.accessToken);

        setAuth({
          user: response.user,
          loading: false,
          isAuthenticated: true,
          error: null,
          mfaRequired: false,
          mfaSessionToken: null,
        });

        return { success: true };
      } catch (err: any) {
        const errorMessage =
          err.response?.data?.message || err.message || 'Login failed';
        setAuth((prev) => ({
          ...prev,
          loading: false,
          error: errorMessage,
        }));
        return { success: false, error: errorMessage };
      }
    },
    []
  );

  const verifyMfa = useCallback(
    async (payload: MfaVerifyPayload): Promise<void> => {
      setAuth((prev) => ({ ...prev, loading: true, error: null }));

      try {
        const response = await fetch(`${apiUrl}/auth/mfa/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            code: payload.code,
            mfaSessionToken: payload.mfaSessionToken,
            useBackupCode: payload.useBackupCode,
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.message || 'MFA verification failed');
        }

        const data = await response.json();

        setStoredToken(data.accessToken);
        setToken(data.accessToken);
        setAuth({
          user: data.user,
          loading: false,
          isAuthenticated: true,
          error: null,
          mfaRequired: false,
          mfaSessionToken: null,
        });
      } catch (err: any) {
        const errorMessage = err.message || 'MFA verification failed';
        setAuth((prev) => ({
          ...prev,
          loading: false,
          error: errorMessage,
        }));
        throw new Error(errorMessage);
      }
    },
    [apiUrl]
  );

  const logout = useCallback(async (): Promise<void> => {
    try {
      await authService.logout();
    } finally {
      // Wipe service worker caches before local state so an attacker who
      // gains read access after logout cannot recover per-user API responses.
      sendMessageToSW({ type: 'CLEAR_USER_CACHE' });
      clearAllTokens();
      // Signal sibling tabs that the session was terminated. The 'storage'
      // event only fires in tabs other than the originator.
      try {
        localStorage.setItem('hw_auth_logout_signal', String(Date.now()));
        localStorage.removeItem('hw_auth_logout_signal');
      } catch {
        // localStorage may be disabled (private mode); cross-tab sync skipped.
      }
      setToken(null);
      setAuth({
        user: null,
        loading: false,
        isAuthenticated: false,
        error: null,
        mfaRequired: false,
        mfaSessionToken: null,
      });
    }
  }, []);

  const refreshUser = useCallback(async (): Promise<void> => {
    try {
      const user = await authService.getCurrentUser();
      setAuth((prev) => ({
        ...prev,
        user,
      }));
    } catch {
      // Silent failure - user profile refresh is non-critical
    }
  }, []);

  const refresh = useCallback(async (): Promise<void> => {
    try {
      const newToken = await refreshAccessToken();
      setToken(newToken);

      const user = await authService.getCurrentUser();
      setAuth({
        user,
        loading: false,
        isAuthenticated: true,
        error: null,
        mfaRequired: false,
        mfaSessionToken: null,
      });
    } catch {
      clearAllTokens();
      setToken(null);
      setAuth({
        user: null,
        loading: false,
        isAuthenticated: false,
        error: null,
        mfaRequired: false,
        mfaSessionToken: null,
      });
    }
  }, []);

  // =========================================================================
  // Session Management
  // =========================================================================

  const getSessions = useCallback(async (): Promise<Session[]> => {
    const response = await fetch(`${apiUrl}/sessions`, {
      headers: {
        Authorization: `Bearer ${getStoredToken()}`,
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to fetch sessions');
    }

    const data = await response.json();
    return data.sessions.map((s: any) => ({
      ...s,
      lastActivityAt: new Date(s.lastActivityAt),
      createdAt: new Date(s.createdAt),
    }));
  }, [apiUrl]);

  const revokeSession = useCallback(
    async (sessionId: string): Promise<void> => {
      const response = await fetch(`${apiUrl}/sessions/${sessionId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${getStoredToken()}`,
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to revoke session');
      }
    },
    [apiUrl]
  );

  const revokeOtherSessions = useCallback(async (): Promise<number> => {
    const response = await fetch(`${apiUrl}/sessions/revoke-others`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${getStoredToken()}`,
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to revoke sessions');
    }

    const data = await response.json();
    return data.revokedCount;
  }, [apiUrl]);

  // =========================================================================
  // MFA Management
  // =========================================================================

  const getMfaStatus = useCallback(async (): Promise<MfaStatus> => {
    const response = await fetch(`${apiUrl}/auth/mfa/status`, {
      headers: {
        Authorization: `Bearer ${getStoredToken()}`,
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to fetch MFA status');
    }

    return response.json();
  }, [apiUrl]);

  const enrollMfa = useCallback(async (): Promise<MfaEnrollment> => {
    const response = await fetch(`${apiUrl}/auth/mfa/enroll/totp`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${getStoredToken()}`,
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to enroll MFA');
    }

    return response.json();
  }, [apiUrl]);

  const verifyMfaEnrollment = useCallback(
    async (code: string): Promise<string[]> => {
      const response = await fetch(`${apiUrl}/auth/mfa/verify/enrollment`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${getStoredToken()}`,
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ code }),
      });

      if (!response.ok) {
        throw new Error('Failed to verify MFA enrollment');
      }

      const data = await response.json();
      return data.recoveryCodes;
    },
    [apiUrl]
  );

  const disableMfa = useCallback(async (): Promise<void> => {
    const response = await fetch(`${apiUrl}/auth/mfa/disable`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${getStoredToken()}`,
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to disable MFA');
    }
  }, [apiUrl]);

  // =========================================================================
  // Password Management
  // =========================================================================

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string): Promise<void> => {
      const response = await fetch(`${apiUrl}/auth/change-password`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${getStoredToken()}`,
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to change password');
      }
    },
    [apiUrl]
  );

  const requestPasswordReset = useCallback(
    async (email: string): Promise<void> => {
      const response = await fetch(`${apiUrl}/auth/password-reset/forgot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to request password reset');
      }
    },
    [apiUrl]
  );

  // =========================================================================
  // Role & Permission Helpers
  // =========================================================================

  const hasRole = useCallback(
    (role: string): boolean => {
      return auth.user?.roles?.includes(role) ?? false;
    },
    [auth.user]
  );

  const hasPermission = useCallback(
    (permission: string): boolean => {
      if (auth.user?.roles?.some((role) => role === 'admin' || role === 'super_admin')) {
        return true;
      }
      return auth.user?.permissions?.includes(permission) ?? false;
    },
    [auth.user]
  );

  const hasAnyRole = useCallback(
    (roles: string[]): boolean => {
      return roles.some((role) => auth.user?.roles?.includes(role));
    },
    [auth.user]
  );

  const hasAnyPermission = useCallback(
    (permissions: string[]): boolean => {
      if (auth.user?.roles?.some((role) => role === 'admin' || role === 'super_admin')) {
        return true;
      }
      return permissions.some((perm) => auth.user?.permissions?.includes(perm));
    },
    [auth.user]
  );

  // =========================================================================
  // Initialize Auth State
  // =========================================================================

  useEffect(() => {
    const initializeAuth = async () => {
      const storedToken = getStoredToken();
      sessionStorage.removeItem('auth_debug');

      if (storedToken) {
        try {
          const user = await authService.getCurrentUser();
          setAuth({
            user,
            loading: false,
            isAuthenticated: true,
            error: null,
            mfaRequired: false,
            mfaSessionToken: null,
          });
        } catch {
          await refresh();
        }
      } else {
        // No token in memory, try refresh via HttpOnly cookie
        try {
          await refresh();
        } catch {
          // No valid session
          setAuth({
            user: null,
            loading: false,
            isAuthenticated: false,
            error: null,
            mfaRequired: false,
            mfaSessionToken: null,
          });
        }
      }
    };

    initializeAuth();
  }, [refresh]);

  // Cross-tab logout synchronization. When any tab calls logout() it writes a
  // sentinel value to localStorage which fires a 'storage' event in every
  // other tab; those tabs clear their auth state so no tab is left believing
  // the user is still signed in. The legacy token key is also watched in case
  // it is ever cleared directly.
  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      const isLogoutSignal = event.key === 'hw_auth_logout_signal' && event.newValue !== null;
      const isLegacyTokenCleared =
        event.key === LEGACY_TOKEN_STORAGE_KEY && event.newValue === null;
      if (isLogoutSignal || isLegacyTokenCleared) {
        clearAllTokens();
        setToken(null);
        setAuth({
          user: null,
          loading: false,
          isAuthenticated: false,
          error: null,
          mfaRequired: false,
          mfaSessionToken: null,
        });
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  // =========================================================================
  // Context Value
  // =========================================================================

  const value = useMemo(
    (): AuthContextType => ({
      auth,
      token,
      login,
      verifyMfa,
      logout,
      refresh,
      refreshUser,
      getSessions,
      revokeSession,
      revokeOtherSessions,
      getMfaStatus,
      enrollMfa,
      verifyMfaEnrollment,
      disableMfa,
      changePassword,
      requestPasswordReset,
      hasRole,
      hasPermission,
      hasAnyRole,
      hasAnyPermission,
    }),
    [
      auth,
      token,
      login,
      verifyMfa,
      logout,
      refresh,
      refreshUser,
      getSessions,
      revokeSession,
      revokeOtherSessions,
      getMfaStatus,
      enrollMfa,
      verifyMfaEnrollment,
      disableMfa,
      changePassword,
      requestPasswordReset,
      hasRole,
      hasPermission,
      hasAnyRole,
      hasAnyPermission,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// ============================================================================
// Hook
// ============================================================================

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
