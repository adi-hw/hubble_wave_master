import axios, { type AxiosError, type AxiosInstance, type AxiosRequestConfig } from 'axios';
import { getTenantSlug, getStoredToken, setStoredToken, refreshAccessToken } from './token';
import { hardRedirectToLogin } from './navigation';

export interface ApiRequestConfig extends AxiosRequestConfig {
  _retry?: boolean;
  skipAuthRefresh?: boolean;
}

const TENANT_SLUG = getTenantSlug();

export function createApiClient(baseURL: string): AxiosInstance {
  const api = axios.create({
    baseURL,
    headers: { 'Content-Type': 'application/json' },
    // SECURITY: Always include credentials to send HttpOnly cookies
    withCredentials: true,
  });

  api.interceptors.request.use((config) => {
    const token = getStoredToken();
    if (token) {
      config.headers = config.headers ?? {};
      config.headers.Authorization = `Bearer ${token}`;
    }
    if (TENANT_SLUG) {
      config.headers = config.headers ?? {};
      config.headers['x-tenant-slug'] = TENANT_SLUG;
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
        if (!currentToken) {
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
