/**
 * Navigation Service (V2)
 *
 * API client for the new navigation system.
 */

import { createApiClient } from './api';
import {
  ResolvedNavigation,
  NavProfileSummary,
  NavSearchResult,
  SwitchProfileRequest,
  ToggleFavoriteRequest,
  RecordNavigationRequest,
  NavigationCacheStats,
} from '../types/navigation-v2';

// Use identity service for navigation endpoints
const IDENTITY_API_URL = import.meta.env.VITE_IDENTITY_API_URL ?? '/api/identity';
const navigationApi = createApiClient(IDENTITY_API_URL);

/**
 * Navigation service for the new navigation system
 */
export const navigationService = {
  /**
   * Get resolved navigation for current user
   */
  async getNavigation(contextTags?: string[]): Promise<ResolvedNavigation> {
    const params = new URLSearchParams();
    if (contextTags?.length) {
      params.set('contextTags', contextTags.join(','));
    }
    const query = params.toString();
    const url = query ? `/navigation?${query}` : '/navigation';
    const res = await navigationApi.get<ResolvedNavigation>(url);
    return res.data;
  },

  /**
   * Get available navigation profiles
   */
  async getProfiles(): Promise<NavProfileSummary[]> {
    const res = await navigationApi.get<NavProfileSummary[]>('/navigation/profiles');
    return res.data;
  },

  /**
   * Switch to a different navigation profile
   */
  async switchProfile(profileId: string): Promise<void> {
    const body: SwitchProfileRequest = { profileId };
    await navigationApi.post('/navigation/profiles/switch', body);
  },

  /**
   * Search navigation items
   */
  async search(query: string, limit = 20): Promise<NavSearchResult[]> {
    const params = new URLSearchParams({ q: query, limit: String(limit) });
    const res = await navigationApi.get<NavSearchResult[]>(`/navigation/search?${params}`);
    return res.data;
  },

  /**
   * Toggle favorite status for a module
   */
  async toggleFavorite(moduleKey: string): Promise<{ favorites: string[] }> {
    const body: ToggleFavoriteRequest = { moduleKey };
    const res = await navigationApi.post<{ favorites: string[] }>(
      '/navigation/favorites/toggle',
      body
    );
    return res.data;
  },

  /**
   * Record navigation to a module (for recent/frequent tracking)
   */
  async recordNavigation(moduleKey: string): Promise<void> {
    const body: RecordNavigationRequest = { moduleKey };
    await navigationApi.post('/navigation/record', body);
  },

  /**
   * Get cache statistics (admin only)
   */
  async getCacheStats(): Promise<NavigationCacheStats> {
    const res = await navigationApi.get<NavigationCacheStats>('/navigation/cache/stats');
    return res.data;
  },

  /**
   * Clear navigation cache (admin only)
   */
  async clearCache(): Promise<void> {
    await navigationApi.post('/navigation/cache/clear');
  },
};
