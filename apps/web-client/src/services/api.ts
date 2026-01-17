import axios, { type AxiosError, type AxiosInstance, type AxiosRequestConfig } from 'axios';
import { getStoredToken, setStoredToken, refreshAccessToken } from './token';
import { hardRedirectToLogin } from './navigation';

export interface ApiRequestConfig extends AxiosRequestConfig {
  _retry?: boolean;
  skipAuthRefresh?: boolean;
}

/**
 * Get CSRF token from cookie
 * The backend sets XSRF-TOKEN cookie which we need to send back in X-XSRF-TOKEN header
 */
function getCsrfToken(): string | null {
  const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export function createApiClient(baseURL: string): AxiosInstance {
  const api = axios.create({
    baseURL,
    headers: { 'Content-Type': 'application/json' },
    // SECURITY: Always include credentials to send HttpOnly cookies
    withCredentials: true,
  });

  api.interceptors.request.use((config) => {
    config.headers = config.headers ?? {};

    // Add Authorization header if we have a token
    const token = getStoredToken();
    console.log('[API] Request interceptor', {
      url: config.url,
      baseURL,
      hasToken: !!token,
      tokenLength: token?.length,
    });
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Add CSRF token for state-changing requests (POST, PUT, PATCH, DELETE)
    const method = (config.method || 'GET').toUpperCase();
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      const csrfToken = getCsrfToken();
      if (csrfToken) {
        config.headers['X-XSRF-TOKEN'] = csrfToken;
      }
    }

    return config;
  });

  api.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      const originalRequest = error.config as ApiRequestConfig;

      // Do not attempt refresh logic for explicit opt-out or auth endpoints like login/refresh
      const requestUrl = originalRequest?.url ?? '';
      const shouldBypassAuthRetry =
        originalRequest?.skipAuthRefresh ||
        requestUrl.includes('/auth/login') ||
        requestUrl.includes('/auth/refresh');

      if (shouldBypassAuthRetry) {
        return Promise.reject(error);
      }

      if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
        originalRequest._retry = true;

        // Only attempt refresh if we have an access token (user was logged in)
        // If no token exists, user needs to log in - don't bother trying refresh
        const currentToken = getStoredToken();
        console.log('[API] 401 response interceptor', {
          url: requestUrl,
          hasToken: !!currentToken,
          tokenLength: currentToken?.length,
        });
        if (!currentToken) {
          console.error('[API] No token on 401, redirecting to login');
          sessionStorage.setItem('auth_debug', JSON.stringify({
            time: new Date().toISOString(),
            reason: 'no_token_on_401',
            url: requestUrl,
          }));
          hardRedirectToLogin();
          return Promise.reject(error);
        }

        try {
          const newAccessToken = await refreshAccessToken();
          originalRequest.headers = {
            ...(originalRequest.headers ?? {}),
            Authorization: `Bearer ${newAccessToken}`,
          };
          return api(originalRequest);
        } catch (refreshError) {
          sessionStorage.setItem('auth_debug', JSON.stringify({
            time: new Date().toISOString(),
            reason: 'refresh_failed',
            url: requestUrl,
            error: (refreshError as Error)?.message,
          }));
          setStoredToken(null);
          // SECURITY: Refresh token is in HttpOnly cookie, cleared by backend
          hardRedirectToLogin();
          return Promise.reject(refreshError);
        }
      }
      return Promise.reject(error);
    }
  );

  return api;
}

// Default data API client (data service) using the shared factory
// In development, use proxy path to avoid cross-origin cookie issues
const DATA_API_URL = import.meta.env.VITE_DATA_API_URL ?? '/api/data';
const api = createApiClient(DATA_API_URL);
export default api;
