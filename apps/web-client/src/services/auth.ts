import { clearAllTokens } from './token';
import { createApiClient, type ApiRequestConfig } from './api';
import { hardRedirectToLogin } from './navigation';

// Point to identity service for authentication
// In development, use proxy path to avoid cross-origin cookie issues
const IDENTITY_API_URL =
  import.meta.env.VITE_IDENTITY_API_URL ?? '/api/identity';

const identityApi = createApiClient(IDENTITY_API_URL);

export interface User {
  id: string;
  username: string;
  email: string;
  displayName?: string;
  isAdmin: boolean;
  roles: string[];
  permissions?: string[];
  mfaEnabled?: boolean;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export interface SsoProvider {
  id: string;
  name: string;
  slug: string;
  type: 'oidc' | 'saml';
}

export interface SsoConfig {
  enabled: boolean;
  googleEnabled: boolean;
  microsoftEnabled: boolean;
  samlEnabled: boolean;
  oidcEnabled: boolean;
  enterpriseSsoEnabled: boolean;
  providers: SsoProvider[];
}

export interface Session {
  id: string;
  deviceType: 'desktop' | 'mobile' | 'tablet';
  browser: string;
  os: string;
  ipAddress: string;
  location?: string;
  lastActive: Date;
  isCurrent: boolean;
  createdAt: Date;
}

export const normalizeUser = (raw: any): User => ({
  id: raw?.id ?? raw?.userId ?? '',
  username: raw?.username ?? '',
  email: raw?.email ?? '',
  displayName: raw?.displayName ?? raw?.username ?? '',
  isAdmin: raw?.isAdmin ?? false,
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

  /**
   * Get SSO configuration - what providers are enabled
   */
  getSsoConfig: async (): Promise<SsoConfig> => {
    try {
      const response = await identityApi.get('/auth/sso/config', {
        skipAuthRefresh: true,
      } as ApiRequestConfig);
      return response.data as SsoConfig;
    } catch {
      // If SSO config endpoint fails, return disabled state
      return {
        enabled: false,
        googleEnabled: false,
        microsoftEnabled: false,
        samlEnabled: false,
        oidcEnabled: false,
        enterpriseSsoEnabled: false,
        providers: [],
      };
    }
  },

  /**
   * Get active sessions for the current user
   */
  getSessions: async (): Promise<Session[]> => {
    const response = await identityApi.get('/auth/sessions');
    const data = response.data as any;
    return (data.sessions || []).map((s: any) => ({
      id: s.id,
      deviceType: s.deviceType || 'desktop',
      browser: s.browser || 'Unknown',
      os: s.os || 'Unknown',
      ipAddress: s.ipAddress || s.ip_address || '',
      location: s.location,
      lastActive: new Date(s.lastActive || s.last_active || s.createdAt),
      isCurrent: s.isCurrent || s.is_current || false,
      createdAt: new Date(s.createdAt || s.created_at),
    }));
  },

  /**
   * Revoke a specific session
   */
  revokeSession: async (sessionId: string): Promise<void> => {
    await identityApi.delete(`/auth/sessions/${sessionId}`);
  },

  /**
   * Revoke all sessions except the current one
   */
  revokeAllOtherSessions: async (): Promise<void> => {
    await identityApi.post('/auth/sessions/revoke-others');
  },

  /**
   * Verify email using token
   */
  verifyEmail: async (token: string): Promise<{ success: boolean; message: string }> => {
    const response = await identityApi.post('/auth/email/verify', { token }, {
      skipAuthRefresh: true,
    } as ApiRequestConfig);
    return response.data as { success: boolean; message: string };
  },

  /**
   * Get email verification status
   */
  getEmailVerificationStatus: async (): Promise<{
    emailVerified: boolean;
    email: string;
    emailVerifiedAt: Date | null;
    canResend: boolean;
    resendAvailableAt: Date | null;
  }> => {
    const response = await identityApi.get('/auth/email/status');
    return response.data as {
      emailVerified: boolean;
      email: string;
      emailVerifiedAt: Date | null;
      canResend: boolean;
      resendAvailableAt: Date | null;
    };
  },

  /**
   * Resend verification email
   */
  resendVerificationEmail: async (): Promise<{ success: boolean; message: string }> => {
    const response = await identityApi.post('/auth/email/resend');
    return response.data as { success: boolean; message: string };
  },
};
