// SECURITY: Tokens stored in memory only to prevent XSS attacks
// - Access tokens: In-memory variable (cleared on page refresh)
// - Refresh tokens: HttpOnly cookies (set by backend, not accessible via JS)
//
// IMPORTANT: This is more secure than localStorage because:
// 1. XSS attacks cannot steal tokens from memory (no persistent storage)
// 2. HttpOnly cookies cannot be read by JavaScript
// 3. On page refresh, we attempt silent refresh via HttpOnly cookie

let inMemoryAccessToken: string | null = null;

export const getStoredToken = (): string | null => inMemoryAccessToken;

export const setStoredToken = (token: string | null) => {
  inMemoryAccessToken = token;
  // SECURITY: Also clear any legacy localStorage tokens
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
};

export const clearAllTokens = () => {
  inMemoryAccessToken = null;
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
};

export const deriveTenantSlug = (hostname: string): string | null => {
  if (!hostname) return null;
  const parts = hostname.split('.');
  // Handle patterns like acme.localhost or acme.example.com
  if (parts.length >= 2 && parts[0] && parts[0] !== 'localhost') {
    return parts[0];
  }
  return null;
};

// Resolve tenant slug from host, falling back to env/default for local/dev
export const getTenantSlug = (): string | null => {
  const host = typeof window !== 'undefined' ? window.location.hostname : '';
  return (
    deriveTenantSlug(host) ||
    (import.meta.env.VITE_DEFAULT_TENANT_SLUG as string | undefined) ||
    (typeof process !== 'undefined' ? process.env.VITE_DEFAULT_TENANT_SLUG : undefined) ||
    'acme'
  );
};

export const hasTenantInHost = (): boolean => {
  const host = typeof window !== 'undefined' ? window.location.hostname : '';
  return !!deriveTenantSlug(host);
};

/**
 * Refresh access token using HttpOnly cookie
 * SECURITY: Refresh token is stored in HttpOnly cookie (set by backend)
 * This function only retrieves the new access token
 */
export const refreshAccessToken = async (): Promise<string> => {
  // Use env variable which points to proxy path in dev (same origin, no CORS issues)
  const IDENTITY_API_URL =
    import.meta.env.VITE_IDENTITY_API_URL ??
    (window.location.hostname.includes('localhost')
      ? '/api/identity'
      : `${window.location.origin}/api`);

  const tenantSlug = getTenantSlug();

  const response = await fetch(`${IDENTITY_API_URL}/auth/refresh`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(tenantSlug ? { 'x-tenant-slug': tenantSlug } : {}),
    },
    // SECURITY: Always include credentials to send HttpOnly cookie
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('Failed to refresh token');
  }

  const data = await response.json();
  setStoredToken(data.accessToken);
  // SECURITY: Do NOT store refresh token in localStorage
  // Backend sets it as HttpOnly cookie
  return data.accessToken;
};
