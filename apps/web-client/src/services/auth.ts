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
  login: async (username: string, password: string, rememberMe?: boolean, mfaToken?: string): Promise<LoginResponse> => {
    const response = await identityApi.post(
      '/auth/login',
      {
        username,
        password,
        rememberMe,
        mfaToken,
      },
      { skipAuthRefresh: true } as ApiRequestConfig
    );
    const data = response.data as any;

    // Handle MFA required response - pass through the raw response
    if (data.mfaRequired) {
      return data as any;
    }

    // Handle password expired response - pass through the raw response
    if (data.passwordExpired) {
      return data as any;
    }

    // Normal successful login
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
      // SECURITY: Clear all tokens from memory and localStorage
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

  // ==========================================================================
  // MFA (Two-Factor Authentication)
  // ==========================================================================

  /**
   * Get MFA status for current user
   */
  getMfaStatus: async (): Promise<{ enabled: boolean; type?: string }> => {
    const response = await identityApi.get('/auth/mfa/status');
    return response.data as { enabled: boolean; type?: string };
  },

  /**
   * Start MFA enrollment - get QR code and recovery codes
   */
  startMfaEnrollment: async (appName?: string): Promise<{
    qrCode: string;
    recoveryCodes: string[];
    message: string;
  }> => {
    const response = await identityApi.post('/auth/mfa/enroll/totp', { appName });
    return response.data as {
      qrCode: string;
      recoveryCodes: string[];
      message: string;
    };
  },

  /**
   * Verify MFA enrollment with TOTP code
   */
  verifyMfaEnrollment: async (token: string): Promise<{ success: boolean; message: string }> => {
    const response = await identityApi.post('/auth/mfa/verify/enrollment', { token });
    return response.data as { success: boolean; message: string };
  },

  /**
   * Disable MFA for current user
   */
  disableMfa: async (): Promise<{ message: string }> => {
    const response = await identityApi.delete('/auth/mfa/disable');
    return response.data as { message: string };
  },

  // ==========================================================================
  // WebAuthn / Passkeys
  // ==========================================================================

  /**
   * List registered passkeys for current user
   */
  listPasskeys: async (): Promise<Array<{
    id: string;
    name: string;
    createdAt: Date;
    lastUsedAt?: Date;
    signCount: number;
  }>> => {
    const response = await identityApi.get('/auth/webauthn/credentials');
    return (response.data as any[]).map((cred) => ({
      ...cred,
      createdAt: new Date(cred.createdAt),
      lastUsedAt: cred.lastUsedAt ? new Date(cred.lastUsedAt) : undefined,
    }));
  },

  /**
   * Start passkey registration
   */
  startPasskeyRegistration: async (options?: {
    credentialName?: string;
    authenticatorType?: 'platform' | 'cross-platform';
  }): Promise<{
    challenge: string;
    rpId: string;
    rpName: string;
    user: { id: string; name: string; displayName: string };
    pubKeyCredParams: Array<{ type: string; alg: number }>;
    authenticatorSelection: {
      authenticatorAttachment?: string;
      requireResidentKey: boolean;
      userVerification: string;
    };
    timeout: number;
    attestation: string;
    excludeCredentials: Array<{ id: string; type: string; transports: string[] }>;
  }> => {
    const response = await identityApi.post('/auth/webauthn/register/start', options);
    return response.data as any;
  },

  /**
   * Complete passkey registration
   */
  completePasskeyRegistration: async (data: {
    credentialName?: string;
    attestation: {
      id: string;
      rawId: string;
      type: 'public-key';
      response: {
        clientDataJSON: string;
        attestationObject: string;
        transports?: string[];
      };
    };
  }): Promise<{
    success: boolean;
    credential: { id: string; name: string; createdAt: Date };
  }> => {
    const response = await identityApi.post('/auth/webauthn/register/complete', data);
    return response.data as any;
  },

  /**
   * Rename a passkey
   */
  renamePasskey: async (credentialId: string, name: string): Promise<{ success: boolean }> => {
    const response = await identityApi.post(`/auth/webauthn/credentials/${credentialId}/rename`, { name });
    return response.data as { success: boolean };
  },

  /**
   * Delete a passkey
   */
  deletePasskey: async (credentialId: string): Promise<{ success: boolean }> => {
    const response = await identityApi.delete(`/auth/webauthn/credentials/${credentialId}`);
    return response.data as { success: boolean };
  },

  // ==========================================================================
  // Device Trust
  // ==========================================================================

  /**
   * List trusted devices for current user
   */
  listTrustedDevices: async (): Promise<Array<{
    id: string;
    deviceName: string;
    deviceType: 'desktop' | 'mobile' | 'tablet' | 'unknown';
    browser: string;
    os: string;
    status: string;
    lastSeenAt: Date;
    trustedUntil?: Date;
  }>> => {
    const response = await identityApi.get('/auth/devices');
    return (response.data as any[]).map((device) => ({
      ...device,
      lastSeenAt: new Date(device.lastSeenAt),
      trustedUntil: device.trustedUntil ? new Date(device.trustedUntil) : undefined,
    }));
  },

  /**
   * Revoke a trusted device
   */
  revokeTrustedDevice: async (deviceId: string, reason?: string): Promise<{ success: boolean }> => {
    const response = await identityApi.delete(`/auth/devices/${deviceId}`, {
      data: { reason },
    });
    return response.data as { success: boolean };
  },

  /**
   * Revoke all trusted devices
   */
  revokeAllTrustedDevices: async (reason?: string): Promise<{ success: boolean; count: number }> => {
    const response = await identityApi.post('/auth/devices/revoke-all', { reason });
    return response.data as { success: boolean; count: number };
  },

  // ==========================================================================
  // Security Alerts
  // ==========================================================================

  /**
   * Get security alerts for current user
   */
  getSecurityAlerts: async (options?: {
    status?: 'new' | 'acknowledged' | 'resolved' | 'false_positive';
    limit?: number;
    offset?: number;
  }): Promise<{
    alerts: Array<{
      id: string;
      type: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
      title: string;
      description: string;
      details?: Record<string, unknown>;
      status: string;
      createdAt: Date;
      acknowledgedAt?: Date;
    }>;
    total: number;
  }> => {
    const response = await identityApi.get('/auth/security/alerts', { params: options });
    const data = response.data as any;
    return {
      alerts: (data.alerts || []).map((alert: any) => ({
        ...alert,
        createdAt: new Date(alert.createdAt),
        acknowledgedAt: alert.acknowledgedAt ? new Date(alert.acknowledgedAt) : undefined,
      })),
      total: data.total || 0,
    };
  },

  /**
   * Acknowledge a security alert
   */
  acknowledgeSecurityAlert: async (alertId: string): Promise<{ success: boolean }> => {
    const response = await identityApi.post(`/auth/security/alerts/${alertId}/acknowledge`);
    return response.data as { success: boolean };
  },

  /**
   * Mark alert as false positive
   */
  markAlertFalsePositive: async (alertId: string): Promise<{ success: boolean }> => {
    const response = await identityApi.post(`/auth/security/alerts/${alertId}/false-positive`);
    return response.data as { success: boolean };
  },

  // ==========================================================================
  // Magic Link Authentication
  // ==========================================================================

  /**
   * Request a magic link for passwordless login
   */
  requestMagicLink: async (email: string, redirectUrl?: string): Promise<{
    success: boolean;
    message: string;
    expiresAt: Date;
  }> => {
    const response = await identityApi.post('/auth/magic-link/request', {
      email,
      redirectUrl,
    }, { skipAuthRefresh: true } as ApiRequestConfig);
    const data = response.data as any;
    return {
      success: data.success,
      message: data.message,
      expiresAt: new Date(data.expiresAt),
    };
  },

  /**
   * Check magic link status
   */
  getMagicLinkStatus: async (email: string): Promise<{
    hasPending: boolean;
    expiresAt?: Date;
  }> => {
    const response = await identityApi.get('/auth/magic-link/status', {
      params: { email },
      skipAuthRefresh: true,
    } as ApiRequestConfig);
    const data = response.data as any;
    return {
      hasPending: data.hasPending,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined,
    };
  },

  /**
   * Verify magic link token
   */
  verifyMagicLink: async (token: string): Promise<{
    success: boolean;
    accessToken: string;
    refreshToken: string;
    user: User;
    redirectUrl?: string;
  }> => {
    const response = await identityApi.get('/auth/magic-link/verify', {
      params: { token },
      skipAuthRefresh: true,
    } as ApiRequestConfig);
    const data = response.data as any;
    return {
      success: data.success,
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      user: normalizeUser(data.user),
      redirectUrl: data.redirectUrl,
    };
  },

  // ==========================================================================
  // Password Management
  // ==========================================================================

  /**
   * Change password
   */
  changePassword: async (currentPassword: string, newPassword: string): Promise<{ success: boolean; message: string }> => {
    const response = await identityApi.post('/auth/change-password', {
      currentPassword,
      newPassword,
    });
    return response.data as { success: boolean; message: string };
  },

  // ==========================================================================
  // Impersonation (Admin)
  // ==========================================================================

  /**
   * Start impersonating a user (admin only)
   */
  startImpersonation: async (targetUserId: string, reason: string, durationMinutes?: number): Promise<{
    success: boolean;
    sessionId: string;
    targetUserId: string;
    expiresAt: Date;
    message: string;
  }> => {
    const response = await identityApi.post('/auth/impersonation/start', {
      targetUserId,
      reason,
      durationMinutes,
    });
    const data = response.data as any;
    return {
      ...data,
      expiresAt: new Date(data.expiresAt),
    };
  },

  /**
   * End current impersonation session
   */
  endImpersonation: async (): Promise<{ success: boolean; message: string }> => {
    const response = await identityApi.post('/auth/impersonation/end');
    return response.data as { success: boolean; message: string };
  },

  /**
   * Get current impersonation status
   */
  getImpersonationStatus: async (): Promise<{
    isImpersonating: boolean;
    sessionId?: string;
    targetUserId?: string;
    targetUser?: { id: string; email: string; displayName: string };
    startedAt?: Date;
    expiresAt?: Date;
    actionsCount?: number;
  }> => {
    const response = await identityApi.get('/auth/impersonation/status');
    const data = response.data as any;
    return {
      ...data,
      startedAt: data.startedAt ? new Date(data.startedAt) : undefined,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined,
    };
  },

  /**
   * List impersonation sessions (admin audit)
   */
  listImpersonationSessions: async (options?: {
    impersonatorId?: string;
    targetUserId?: string;
    activeOnly?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<{
    sessions: Array<{
      id: string;
      impersonator?: { id: string; email: string; displayName: string };
      targetUser?: { id: string; email: string; displayName: string };
      reason: string;
      isActive: boolean;
      startedAt: Date;
      endedAt?: Date;
      expiresAt: Date;
      actionsCount: number;
    }>;
    total: number;
  }> => {
    const response = await identityApi.get('/auth/impersonation/sessions', { params: options });
    const data = response.data as any;
    return {
      sessions: (data.sessions || []).map((s: any) => ({
        ...s,
        startedAt: new Date(s.startedAt),
        endedAt: s.endedAt ? new Date(s.endedAt) : undefined,
        expiresAt: new Date(s.expiresAt),
      })),
      total: data.total || 0,
    };
  },

  /**
   * Terminate all active impersonation sessions (emergency)
   */
  terminateAllImpersonations: async (): Promise<{ success: boolean; terminatedCount: number; message: string }> => {
    const response = await identityApi.post('/auth/impersonation/terminate-all');
    return response.data as { success: boolean; terminatedCount: number; message: string };
  },

  // ==========================================================================
  // Delegations
  // ==========================================================================

  /**
   * Create a new delegation
   */
  createDelegation: async (data: {
    delegateId: string;
    name: string;
    reason?: string;
    delegatedPermissions?: string[];
    delegatedRoles?: string[];
    startsAt?: Date;
    endsAt: Date;
    requiresApproval?: boolean;
    scopeRestrictions?: Record<string, unknown>;
  }): Promise<{
    success: boolean;
    delegation: {
      id: string;
      name: string;
      status: string;
      delegateId: string;
      delegatedPermissions: string[];
      delegatedRoles: string[];
      startsAt: Date;
      endsAt: Date;
      createdAt: Date;
    };
  }> => {
    const response = await identityApi.post('/auth/delegations', {
      ...data,
      startsAt: data.startsAt?.toISOString(),
      endsAt: data.endsAt.toISOString(),
    });
    const result = response.data as any;
    return {
      success: result.success,
      delegation: {
        ...result.delegation,
        startsAt: new Date(result.delegation.startsAt),
        endsAt: new Date(result.delegation.endsAt),
        createdAt: new Date(result.delegation.createdAt),
      },
    };
  },

  /**
   * Get delegations I've created
   */
  getDelegationsCreated: async (includeExpired?: boolean): Promise<{
    delegations: Array<{
      id: string;
      name: string;
      status: string;
      delegate?: { id: string; email: string; displayName: string };
      delegatedPermissions: string[];
      delegatedRoles: string[];
      startsAt: Date;
      endsAt: Date;
      createdAt: Date;
    }>;
  }> => {
    const response = await identityApi.get('/auth/delegations/created', {
      params: { includeExpired: includeExpired ? 'true' : undefined },
    });
    const data = response.data as any;
    return {
      delegations: (data.delegations || []).map((d: any) => ({
        ...d,
        startsAt: new Date(d.startsAt),
        endsAt: new Date(d.endsAt),
        createdAt: new Date(d.createdAt),
      })),
    };
  },

  /**
   * Get delegations I've received
   */
  getDelegationsReceived: async (): Promise<{
    delegations: Array<{
      id: string;
      name: string;
      status: string;
      delegator?: { id: string; email: string; displayName: string };
      delegatedPermissions: string[];
      delegatedRoles: string[];
      startsAt: Date;
      endsAt: Date;
    }>;
  }> => {
    const response = await identityApi.get('/auth/delegations/received');
    const data = response.data as any;
    return {
      delegations: (data.delegations || []).map((d: any) => ({
        ...d,
        startsAt: new Date(d.startsAt),
        endsAt: new Date(d.endsAt),
      })),
    };
  },

  /**
   * Get effective permissions (own + delegated)
   */
  getEffectivePermissions: async (): Promise<{
    delegatedPermissions: string[];
    delegatedRoles: string[];
    activeDelegations: Array<{ id: string; name: string; delegatorId: string; endsAt: Date }>;
  }> => {
    const response = await identityApi.get('/auth/delegations/effective-permissions');
    const data = response.data as any;
    return {
      delegatedPermissions: data.delegatedPermissions || [],
      delegatedRoles: data.delegatedRoles || [],
      activeDelegations: (data.activeDelegations || []).map((d: any) => ({
        ...d,
        endsAt: new Date(d.endsAt),
      })),
    };
  },

  /**
   * Revoke a delegation
   */
  revokeDelegation: async (delegationId: string, reason?: string): Promise<{
    success: boolean;
    delegation: { id: string; status: string; revokedAt: Date };
  }> => {
    const response = await identityApi.delete(`/auth/delegations/${delegationId}`, {
      data: { reason },
    });
    const data = response.data as any;
    return {
      success: data.success,
      delegation: {
        ...data.delegation,
        revokedAt: new Date(data.delegation.revokedAt),
      },
    };
  },

  /**
   * Get delegation by ID
   */
  getDelegation: async (delegationId: string): Promise<{
    found: boolean;
    delegation?: {
      id: string;
      name: string;
      reason?: string;
      status: string;
      delegator?: { id: string; email: string; displayName: string };
      delegate?: { id: string; email: string; displayName: string };
      delegatedPermissions: string[];
      delegatedRoles: string[];
      startsAt: Date;
      endsAt: Date;
      createdAt: Date;
      approvedAt?: Date;
      revokedAt?: Date;
      revocationReason?: string;
    };
  }> => {
    const response = await identityApi.get(`/auth/delegations/${delegationId}`);
    const data = response.data as any;
    if (!data.found) return { found: false };
    return {
      found: true,
      delegation: {
        ...data.delegation,
        startsAt: new Date(data.delegation.startsAt),
        endsAt: new Date(data.delegation.endsAt),
        createdAt: new Date(data.delegation.createdAt),
        approvedAt: data.delegation.approvedAt ? new Date(data.delegation.approvedAt) : undefined,
        revokedAt: data.delegation.revokedAt ? new Date(data.delegation.revokedAt) : undefined,
      },
    };
  },
};
