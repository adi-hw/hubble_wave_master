import api from './api';

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
  user: AuthUser;
}

const TOKEN_KEY = 'control_plane_token';
const USER_KEY = 'control_plane_user';

function clearLocalAuth(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
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

export const authService = {
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>('/auth/login', credentials);
    const { accessToken, user } = response.data;

    // Store token and user
    localStorage.setItem(TOKEN_KEY, accessToken);
    localStorage.setItem(USER_KEY, JSON.stringify(user));

    return response.data;
  },

  // Best-effort server-side logout. The control-plane revokes the access
  // token's `jti` so a stolen bearer token cannot be replayed. The client
  // unconditionally clears local state and redirects after the call - if the
  // network errored the worst case is that the token remains valid until
  // natural expiry, which is no worse than the prior behaviour.
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
    return localStorage.getItem(TOKEN_KEY);
  },

  getUser(): AuthUser | null {
    const userStr = localStorage.getItem(USER_KEY);
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
    localStorage.setItem(USER_KEY, JSON.stringify(response.data));
    return response.data;
  },

  async updateProfile(data: { firstName?: string; lastName?: string; avatarUrl?: string }): Promise<AuthUser> {
    const response = await api.put<AuthUser>('/auth/me', data);
    localStorage.setItem(USER_KEY, JSON.stringify(response.data));
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
