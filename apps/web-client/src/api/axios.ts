import axios from 'axios';
import { getStoredToken, getTenantSlug } from '../services/token';

// In development, use proxy path to avoid cross-origin cookie issues
const baseURL =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_IDENTITY_API_URL ||
  '/api/identity';

export const api = axios.create({
  baseURL,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  config.headers = config.headers || {};

  // Add auth token if available
  const token = getStoredToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // Add tenant slug header for cross-origin requests
  const tenantSlug = getTenantSlug();
  if (tenantSlug) {
    config.headers['X-Tenant-Slug'] = tenantSlug;
  }

  return config;
});
