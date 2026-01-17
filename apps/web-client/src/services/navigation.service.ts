/**
 * Navigation Service
 *
 * API client for the navigation system.
 */

import {
  ResolvedNavigation,
  NavProfileSummary,
} from '../types/navigation';
import identityApi from './identityApi';

type NavProfileResponse = Omit<NavProfileSummary, 'isLocked'>;

/**
 * Navigation service for the new navigation system
 */
export const navigationService = {
  /**
   * Get resolved navigation for current user
   */
  async getNavigation(contextTags?: string[]): Promise<ResolvedNavigation> {
    const params = contextTags?.length ? { contextTags: contextTags.join(',') } : undefined;
    const response = await identityApi.get<ResolvedNavigation>('/navigation', { params });
    return response.data;
  },

  /**
   * Get available navigation profiles
   */
  async getProfiles(): Promise<NavProfileSummary[]> {
    const response = await identityApi.get<NavProfileResponse[]>('/navigation/profiles');
    return response.data.map((profile) => ({
      id: profile.id,
      name: profile.name,
      description: profile.description,
      isActive: profile.isActive,
      isDefault: profile.isDefault,
      isLocked: false,
    }));
  },

  /**
   * Switch to a different navigation profile
   */
  async switchProfile(profileId: string): Promise<void> {
    await identityApi.post('/navigation/profiles/switch', { profileId });
  },

  /**
   * Toggle favorite status for a module
   */
  async toggleFavorite(moduleKey: string): Promise<{ favorites: string[] }> {
    const response = await identityApi.post<{ favorites: string[] }>(
      '/navigation/favorites/toggle',
      { moduleKey }
    );
    return response.data;
  },

  /**
   * Record navigation to a module (for recent/frequent tracking)
   */
  async recordNavigation(moduleKey: string): Promise<void> {
    await identityApi.post('/navigation/record', { moduleKey });
  },
};
