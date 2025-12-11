import { Injectable } from '@nestjs/common';

/**
 * Navigation user preferences
 */
export interface NavigationPreferences {
  activeProfileId?: string;
  favorites: string[];
  recent: { key: string; accessedAt: string }[];
  frequency: Record<string, number>;
}

/**
 * NavigationPreferenceService - Stores user navigation preferences
 *
 * This is a simplified implementation using in-memory storage.
 * In production, this should be backed by Redis or a database table.
 *
 * Stores:
 * - Active profile selection
 * - Favorite modules
 * - Recently accessed modules
 * - Frequency counts for frequently accessed
 */
@Injectable()
export class NavigationPreferenceService {
  // In-memory storage keyed by "tenantId:userId"
  private readonly preferences = new Map<string, NavigationPreferences>();

  /**
   * Get user preferences key
   */
  private getKey(tenantId: string, userId: string): string {
    return `${tenantId}:${userId}`;
  }

  /**
   * Get or create user preferences
   */
  private getPreferences(tenantId: string, userId: string): NavigationPreferences {
    const key = this.getKey(tenantId, userId);
    let prefs = this.preferences.get(key);
    if (!prefs) {
      prefs = {
        favorites: [],
        recent: [],
        frequency: {},
      };
      this.preferences.set(key, prefs);
    }
    return prefs;
  }

  /**
   * Get active profile ID
   */
  getActiveProfileId(tenantId: string, userId: string): string | undefined {
    return this.getPreferences(tenantId, userId).activeProfileId;
  }

  /**
   * Set active profile ID
   */
  setActiveProfileId(tenantId: string, userId: string, profileId: string): void {
    const prefs = this.getPreferences(tenantId, userId);
    prefs.activeProfileId = profileId;
  }

  /**
   * Get favorites
   */
  getFavorites(tenantId: string, userId: string): string[] {
    return this.getPreferences(tenantId, userId).favorites;
  }

  /**
   * Toggle favorite
   */
  toggleFavorite(tenantId: string, userId: string, moduleKey: string): string[] {
    const prefs = this.getPreferences(tenantId, userId);
    const index = prefs.favorites.indexOf(moduleKey);
    if (index >= 0) {
      prefs.favorites.splice(index, 1);
    } else {
      prefs.favorites.push(moduleKey);
    }
    return prefs.favorites;
  }

  /**
   * Get recent modules
   */
  getRecent(tenantId: string, userId: string): { key: string; accessedAt: string }[] {
    return this.getPreferences(tenantId, userId).recent;
  }

  /**
   * Record navigation to a module
   */
  recordNavigation(tenantId: string, userId: string, moduleKey: string): void {
    const prefs = this.getPreferences(tenantId, userId);

    // Update recent
    prefs.recent = prefs.recent.filter((r) => r.key !== moduleKey);
    prefs.recent.unshift({ key: moduleKey, accessedAt: new Date().toISOString() });
    prefs.recent = prefs.recent.slice(0, 20); // Keep last 20

    // Update frequency
    prefs.frequency[moduleKey] = (prefs.frequency[moduleKey] || 0) + 1;
  }

  /**
   * Get most frequent modules
   */
  getFrequent(tenantId: string, userId: string, limit = 5): string[] {
    const prefs = this.getPreferences(tenantId, userId);
    return Object.entries(prefs.frequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([key]) => key);
  }

  /**
   * Clear all preferences for a user
   */
  clearPreferences(tenantId: string, userId: string): void {
    const key = this.getKey(tenantId, userId);
    this.preferences.delete(key);
  }
}
