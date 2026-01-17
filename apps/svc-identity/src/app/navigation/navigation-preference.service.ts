import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserPreference, PinnedNavigationItem } from '@hubblewave/instance-db';

export interface FavoriteModule {
  key: string;
  label?: string;
  icon?: string;
  route?: string;
}

export interface RecentModule {
  key: string;
  label?: string;
  icon?: string;
  route?: string;
  accessedAt: string;
}

@Injectable()
export class NavigationPreferenceService {
  constructor(
    @InjectRepository(UserPreference)
    private readonly prefRepo: Repository<UserPreference>,
  ) {}

  /**
   * Get user's favorite module keys
   */
  async getFavorites(userId: string): Promise<string[]> {
    const prefs = await this.getOrCreatePreferences(userId);
    return prefs.pinnedNavigation
      .filter((item) => item.type === 'module')
      .map((item) => item.code);
  }

  /**
   * Get user's pinned navigation items (full details)
   */
  async getPinnedNavigation(userId: string): Promise<PinnedNavigationItem[]> {
    const prefs = await this.getOrCreatePreferences(userId);
    return prefs.pinnedNavigation;
  }

  /**
   * Toggle a module as favorite
   * Returns the updated list of favorite module keys
   */
  async toggleFavorite(
    userId: string,
    moduleKey: string,
    moduleInfo?: { label?: string; icon?: string; route?: string },
  ): Promise<string[]> {
    const prefs = await this.getOrCreatePreferences(userId);
    const pinnedNavigation = [...prefs.pinnedNavigation];

    const existingIndex = pinnedNavigation.findIndex(
      (item) => item.type === 'module' && item.code === moduleKey,
    );

    if (existingIndex >= 0) {
      // Remove from favorites
      pinnedNavigation.splice(existingIndex, 1);
      // Re-order positions
      pinnedNavigation.forEach((item, idx) => {
        item.position = idx;
      });
    } else {
      // Add to favorites
      const newItem: PinnedNavigationItem = {
        id: crypto.randomUUID(),
        type: 'module',
        code: moduleKey,
        label: moduleInfo?.label || moduleKey,
        icon: moduleInfo?.icon,
        route: moduleInfo?.route,
        position: pinnedNavigation.length,
      };
      pinnedNavigation.push(newItem);
    }

    // Save updated preferences
    prefs.pinnedNavigation = pinnedNavigation;
    await this.prefRepo.save(prefs);

    // Return just the module keys
    return pinnedNavigation
      .filter((item) => item.type === 'module')
      .map((item) => item.code);
  }

  /**
   * Check if a module is favorited
   */
  async isFavorite(userId: string, moduleKey: string): Promise<boolean> {
    const favorites = await this.getFavorites(userId);
    return favorites.includes(moduleKey);
  }

  /**
   * Record a navigation event (for recent modules tracking)
   */
  async recordNavigation(
    userId: string,
    _moduleKey: string,
    _moduleInfo?: { label?: string; icon?: string; route?: string },
  ): Promise<void> {
    await this.getOrCreatePreferences(userId);
  }

  /**
   * Set active profile for session
   */
  private _activeProfileId: string | null = null;

  async setActiveProfile(profileId: string): Promise<void> {
    // Profile switching is handled at the session level
    // The profileId is stored and used in navigation resolution
    this._activeProfileId = profileId;
  }

  getActiveProfileId(): string | null {
    return this._activeProfileId;
  }

  /**
   * Get recent modules for a user
   */
  async getRecent(userId: string): Promise<RecentModule[]> {
    await this.getOrCreatePreferences(userId);
    return [];
  }

  /**
   * Get or create user preferences
   */
  private async getOrCreatePreferences(userId: string): Promise<UserPreference> {
    let prefs = await this.prefRepo.findOne({ where: { userId } });

    if (!prefs) {
      prefs = this.prefRepo.create({
        userId,
        pinnedNavigation: [],
      });
      prefs = await this.prefRepo.save(prefs);
    }

    return prefs;
  }
}
