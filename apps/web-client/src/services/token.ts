// SECURITY: Tokens stored in memory only to prevent XSS attacks
// - Access tokens: In-memory variable (cleared on page refresh)
// - Refresh tokens: HttpOnly cookies (set by backend, not accessible via JS)
//
// IMPORTANT: This is more secure than localStorage because:
// 1. XSS attacks cannot steal tokens from memory (no persistent storage)
// 2. HttpOnly cookies cannot be read by JavaScript
// 3. On page refresh, we attempt silent refresh via HttpOnly cookie

let inMemoryAccessToken: string | null = null;
const moduleId = Math.random().toString(36).substring(7);
console.log('[token.ts] Module loaded, id:', moduleId);

export const getStoredToken = (): string | null => {
  console.log('[token.ts] getStoredToken called', {
    moduleId,
    hasToken: !!inMemoryAccessToken,
    tokenLength: inMemoryAccessToken?.length,
  });
  return inMemoryAccessToken;
};

export const setStoredToken = (token: string | null) => {
  console.log('[token.ts] setStoredToken called', {
    moduleId,
    wasSet: !!token,
    tokenLength: token?.length,
  });
  inMemoryAccessToken = token;
  // SECURITY: Ensure localStorage tokens are cleared
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
};

export const clearAllTokens = () => {
  inMemoryAccessToken = null;
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
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

  const response = await fetch(`${IDENTITY_API_URL}/auth/refresh`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
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
