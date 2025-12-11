import { createApiClient } from './api';

import { NavigationResponse } from '../types/navigation';

export interface ThemeResponse {
  variant: string;
  tokens: Record<string, string | number>;
}

export interface AdminTheme {
  id?: string;
  name?: string;
  nav_variant?: string;
  tokens?: Record<string, string | number>;
}

export interface NavProfileItem {
  id?: string;
  code?: string;
  label?: string;
  section?: string;
  order?: number;
  visible?: boolean;
  icon?: string;
  pinned?: boolean;
}

export interface AdminNavProfile {
  id?: string;
  name?: string;
  is_default?: boolean;
  items?: NavProfileItem[];
}

// UI service uses identity service for basic theme/navigation
// In development, use proxy path to avoid cross-origin cookie issues
const UI_API_URL =
  import.meta.env.VITE_UI_API_URL ??
  import.meta.env.VITE_IDENTITY_API_URL ??
  '/api/identity';

const uiApi = createApiClient(UI_API_URL);

// Studio admin endpoints use metadata service
// In development, use proxy path to avoid cross-origin cookie issues
const METADATA_API_URL = import.meta.env.VITE_METADATA_API_URL ?? '/api/metadata';
const studioApi = createApiClient(METADATA_API_URL);

const fallbackTheme: ThemeResponse = {
  variant: 'glass-dock',
  tokens: {
    'color.primary': '#0ea5e9',
    'color.accent': '#6366f1',
    'color.bg': '#020617',
    'color.surface': 'rgba(15,23,42,0.9)',
    'radius.sm': 10,
    'radius.lg': 18,
    'shadow.level': 'soft',
    'glass.opacity': 0.18,
    'glass.blur': 18,
  },
};

const fallbackNavigation: NavigationResponse = {
  sections: [
    {
      name: 'Studio',
      items: [
        { code: 'studio-dashboard', label: 'Dashboard', icon: 'LayoutDashboard', path: '/studio' },
        { code: 'tables', label: 'Tables', icon: 'Database', path: '/studio/tables' },
        { code: 'scripts', label: 'Scripts', icon: 'FileCode', path: '/studio/scripts' },
        { code: 'business-rules', label: 'Business Rules', icon: 'Shield', path: '/studio/business-rules' },
        { code: 'workflows', label: 'Workflows', icon: 'GitBranch', path: '/studio/workflows' },
        { code: 'platform-config', label: 'Platform Config', icon: 'Settings', path: '/studio/platform-config' },
        { code: 'customizations', label: 'Customizations', icon: 'Layers', path: '/studio/customizations' },
        { code: 'upgrade', label: 'Upgrade Center', icon: 'ArrowUpCircle', path: '/studio/upgrade' },
        { code: 'history', label: 'Change History', icon: 'History', path: '/studio/history' },
      ],
    },
    {
      name: 'Modules',
      items: [
        { code: 'assets', label: 'Assets', icon: 'Package' },
      ],
    },
  ],
  bottomNav: [
    { code: 'assets', label: 'Assets', icon: 'Package' },
    { code: 'studio', label: 'Studio', icon: 'Wrench', path: '/studio' },
    { code: 'more', label: 'More', icon: 'Ellipsis' },
  ],
};

export const uiService = {
  async getTheme(): Promise<ThemeResponse> {
    try {
      const res = await uiApi.get<ThemeResponse>('/ui/theme');
      return res.data;
    } catch (error) {
      console.warn('Falling back to default theme tokens', error);
      return fallbackTheme;
    }
  },
  async getNavigation(): Promise<NavigationResponse> {
    try {
      const res = await uiApi.get<NavigationResponse>('/ui/navigation');
      return res.data;
    } catch (error) {
      console.warn('Falling back to default navigation', error);
      return fallbackNavigation;
    }
  },
  async getAdminTheme(): Promise<AdminTheme> {
    const res = await studioApi.get<AdminTheme>('/studio/ui/theme');
    return res.data;
  },
  async updateAdminTheme(body: AdminTheme): Promise<AdminTheme> {
    const res = await studioApi.put<AdminTheme>('/studio/ui/theme', body);
    return res.data;
  },
  async getAdminNavProfile(): Promise<AdminNavProfile> {
    const res = await studioApi.get<AdminNavProfile>('/studio/ui/nav-profile');
    return res.data;
  },
  async updateAdminNavProfile(body: AdminNavProfile): Promise<AdminNavProfile> {
    const res = await studioApi.put<AdminNavProfile>('/studio/ui/nav-profile', body);
    return res.data;
  },
};
