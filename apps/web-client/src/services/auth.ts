import { getTenantSlug, clearAllTokens } from './token';
import { createApiClient, type ApiRequestConfig } from './api';
import { hardRedirectToLogin } from './navigation';

// Point to identity service for authentication
// In development, use proxy path to avoid cross-origin cookie issues
const IDENTITY_API_URL =
  import.meta.env.VITE_IDENTITY_API_URL ?? '/api/identity';

const TENANT_SLUG = getTenantSlug();

const identityApi = createApiClient(IDENTITY_API_URL);

export interface User {
  id: string;
  username: string;
  email: string;
  displayName?: string;
  roles: string[];
  permissions?: string[];
  tenantId: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export const normalizeUser = (raw: any): User => ({
  id: raw?.id ?? raw?.userId ?? '',
  username: raw?.username ?? '',
  email: raw?.email ?? '',
  displayName: raw?.displayName ?? raw?.username ?? '',
  tenantId: raw?.tenantId ?? '',
  roles: raw?.roles ?? [],
  permissions: raw?.permissions ?? [],
});

export const authService = {
  login: async (username: string, password: string): Promise<LoginResponse> => {
    const response = await identityApi.post(
      '/auth/login',
      {
        username,
        password,
        tenantSlug: TENANT_SLUG ?? undefined,
      },
      { skipAuthRefresh: true } as ApiRequestConfig
    );
    const data = response.data as any;
    return {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      user: normalizeUser(data.user),
    };
  },

  logout: async () => {
    try {
      await identityApi.post('/auth/logout');
    } finally {
      // SECURITY: Clear all tokens from memory and any legacy localStorage entries
      clearAllTokens();
      // Refresh token HttpOnly cookie is cleared by backend via Set-Cookie header
      hardRedirectToLogin();
    }
  },

  getCurrentUser: async (): Promise<User> => {
    const response = await identityApi.get('/iam/me');
    return normalizeUser(response.data);
  },
};
