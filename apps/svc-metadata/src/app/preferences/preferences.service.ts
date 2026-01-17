import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserPreference, PinnedNavigationItem } from '@hubblewave/instance-db';
import {
  UpdateUserPreferencesDto,
  AddPinnedItemDto,
  UpdatePinnedItemDto,
  UserPreferencesResponse,
} from './preferences.dto';
import { v4 as uuidv4, validate as validateUuid } from 'uuid';

@Injectable()
export class PreferencesService {
  constructor(
    @InjectRepository(UserPreference)
    private readonly prefRepo: Repository<UserPreference>,
  ) {}

  /**
   * Get user preferences, creating default if none exist
   */
  async getPreferences(userId: string): Promise<UserPreferencesResponse> {
    this.ensureUserId(userId);
    let pref = await this.prefRepo.findOne({ where: { userId } });

    if (!pref) {
      pref = await this.createDefaultPreferences(userId);
    }

    return this.toResponse(pref);
  }

  /**
   * Update user preferences
   */
  async updatePreferences(
    userId: string,
    dto: UpdateUserPreferencesDto,
  ): Promise<UserPreferencesResponse> {
    this.ensureUserId(userId);
    let pref = await this.prefRepo.findOne({ where: { userId } });

    if (!pref) {
      pref = await this.createDefaultPreferences(userId);
    }

    // Update all provided fields
    const updateFields = [
      'densityMode',
      'sidebarPosition',
      'sidebarCollapsed',
      'sidebarWidth',
      'showBreadcrumbs',
      'showFooter',
      'contentWidth',
      'pinnedNavigation',
      'recentItemsCount',
      'showFavoritesInSidebar',
      'showRecentInSidebar',
      'language',
      'timezone',
      'dateFormat',
      'timeFormat',
      'startOfWeek',
      'numberFormat',
      'notificationPreferences',
      'accessibility',
      'keyboardShortcutsEnabled',
      'customShortcuts',
      'tablePreferences',
      'dashboardPreferences',
      'autoSaveEnabled',
      'autoSaveInterval',
      'confirmBeforeLeave',
      'showFieldDescriptions',
      'searchIncludeArchived',
      'searchResultsPerPage',
      'searchHighlightMatches',
      'homePage',
      'startupPage',
      'avaEnabled',
      'avaAutoSuggest',
      'avaVoiceEnabled',
      'syncEnabled',
    ] as const;

    for (const field of updateFields) {
      if (dto[field] !== undefined) {
        (pref as any)[field] = dto[field];
      }
    }

    // Increment preference version for sync tracking
    pref.preferenceVersion = (pref.preferenceVersion || 0) + 1;

    pref = await this.prefRepo.save(pref);
    return this.toResponse(pref);
  }

  /**
   * Patch specific preference fields (partial update)
   */
  async patchPreferences(
    userId: string,
    patch: Partial<UpdateUserPreferencesDto>,
  ): Promise<UserPreferencesResponse> {
    return this.updatePreferences(userId, patch);
  }

  /**
   * Reset preferences to defaults
   */
  async resetPreferences(userId: string): Promise<UserPreferencesResponse> {
    this.ensureUserId(userId);
    await this.prefRepo.delete({ userId });
    const pref = await this.createDefaultPreferences(userId);
    return this.toResponse(pref);
  }

  // ============================================================================
  // Pinned Navigation
  // ============================================================================

  /**
   * Get pinned navigation items
   */
  async getPinnedNavigation(userId: string): Promise<PinnedNavigationItem[]> {
    this.ensureUserId(userId);
    const pref = await this.getOrCreate(userId);
    return pref.pinnedNavigation || [];
  }

  /**
   * Add a pinned navigation item
   */
  async addPinnedItem(
    userId: string,
    dto: AddPinnedItemDto,
  ): Promise<PinnedNavigationItem[]> {
    this.ensureUserId(userId);
    const pref = await this.getOrCreate(userId);
    const pinnedItems = pref.pinnedNavigation || [];

    // Calculate position
    const maxPosition = pinnedItems.reduce(
      (max, item) => Math.max(max, item.position),
      -1,
    );
    const position = dto.position ?? maxPosition + 1;

    const newItem: PinnedNavigationItem = {
      id: uuidv4(),
      type: dto.type,
      code: dto.code,
      label: dto.label,
      icon: dto.icon,
      route: dto.route,
      position,
    };

    pinnedItems.push(newItem);
    pref.pinnedNavigation = this.normalizePositions(pinnedItems);
    pref.preferenceVersion = (pref.preferenceVersion || 0) + 1;
    await this.prefRepo.save(pref);

    return pref.pinnedNavigation;
  }

  /**
   * Update a pinned navigation item
   */
  async updatePinnedItem(
    userId: string,
    itemId: string,
    dto: UpdatePinnedItemDto,
  ): Promise<PinnedNavigationItem[]> {
    this.ensureUserId(userId);
    const pref = await this.getOrCreate(userId);
    const pinnedItems = pref.pinnedNavigation || [];

    const itemIndex = pinnedItems.findIndex((item) => item.id === itemId);
    if (itemIndex === -1) {
      throw new NotFoundException(`Pinned item ${itemId} not found`);
    }

    if (dto.label !== undefined) pinnedItems[itemIndex].label = dto.label;
    if (dto.icon !== undefined) pinnedItems[itemIndex].icon = dto.icon;
    if (dto.position !== undefined) pinnedItems[itemIndex].position = dto.position;

    pref.pinnedNavigation = this.normalizePositions(pinnedItems);
    pref.preferenceVersion = (pref.preferenceVersion || 0) + 1;
    await this.prefRepo.save(pref);

    return pref.pinnedNavigation;
  }

  /**
   * Remove a pinned navigation item
   */
  async removePinnedItem(
    userId: string,
    itemId: string,
  ): Promise<PinnedNavigationItem[]> {
    this.ensureUserId(userId);
    const pref = await this.getOrCreate(userId);
    const pinnedItems = pref.pinnedNavigation || [];

    const filtered = pinnedItems.filter((item) => item.id !== itemId);
    if (filtered.length === pinnedItems.length) {
      throw new NotFoundException(`Pinned item ${itemId} not found`);
    }

    pref.pinnedNavigation = this.normalizePositions(filtered);
    pref.preferenceVersion = (pref.preferenceVersion || 0) + 1;
    await this.prefRepo.save(pref);

    return pref.pinnedNavigation;
  }

  /**
   * Reorder pinned navigation items
   */
  async reorderPinnedItems(
    userId: string,
    order: string[],
  ): Promise<PinnedNavigationItem[]> {
    this.ensureUserId(userId);
    const pref = await this.getOrCreate(userId);
    const pinnedItems = pref.pinnedNavigation || [];

    // Create a map of existing items
    const itemMap = new Map(pinnedItems.map((item) => [item.id, item]));

    // Reorder based on the provided order
    const reordered: PinnedNavigationItem[] = [];
    order.forEach((id, index) => {
      const item = itemMap.get(id);
      if (item) {
        reordered.push({ ...item, position: index });
        itemMap.delete(id);
      }
    });

    // Add any items not in the order array at the end
    let position = reordered.length;
    itemMap.forEach((item) => {
      reordered.push({ ...item, position: position++ });
    });

    pref.pinnedNavigation = reordered;
    pref.preferenceVersion = (pref.preferenceVersion || 0) + 1;
    await this.prefRepo.save(pref);

    return pref.pinnedNavigation;
  }

  // ============================================================================
  // Layout Preferences
  // ============================================================================

  /**
   * Update density mode
   */
  async setDensityMode(
    userId: string,
    mode: 'compact' | 'comfortable' | 'spacious',
  ): Promise<UserPreferencesResponse> {
    this.ensureUserId(userId);
    return this.updatePreferences(userId, { densityMode: mode });
  }

  /**
   * Update sidebar position
   */
  async setSidebarPosition(
    userId: string,
    position: 'left' | 'right',
  ): Promise<UserPreferencesResponse> {
    this.ensureUserId(userId);
    return this.updatePreferences(userId, { sidebarPosition: position });
  }

  /**
   * Toggle sidebar collapsed state
   */
  async toggleSidebarCollapsed(userId: string): Promise<UserPreferencesResponse> {
    this.ensureUserId(userId);
    const pref = await this.getOrCreate(userId);
    return this.updatePreferences(userId, {
      sidebarCollapsed: !pref.sidebarCollapsed,
    });
  }

  // ============================================================================
  // Sync Preferences
  // ============================================================================

  /**
   * Sync preferences from another device
   */
  async syncPreferences(
    userId: string,
    deviceId: string,
    fromVersion?: number,
  ): Promise<{
    preferences: UserPreferencesResponse;
    hasChanges: boolean;
    currentVersion: number;
  }> {
    this.ensureUserId(userId);
    const pref = await this.getOrCreate(userId);

    const hasChanges = fromVersion ? pref.preferenceVersion > fromVersion : true;

    // Update sync metadata
    pref.lastSyncDevice = deviceId;
    pref.lastSyncedAt = new Date();
    await this.prefRepo.save(pref);

    return {
      preferences: this.toResponse(pref),
      hasChanges,
      currentVersion: pref.preferenceVersion,
    };
  }

  /**
   * Get preference version for sync check
   */
  async getPreferenceVersion(userId: string): Promise<{
    version: number;
    lastSyncedAt?: Date;
    lastSyncDevice?: string;
  }> {
    this.ensureUserId(userId);
    const pref = await this.getOrCreate(userId);
    return {
      version: pref.preferenceVersion,
      lastSyncedAt: pref.lastSyncedAt,
      lastSyncDevice: pref.lastSyncDevice,
    };
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  private async getOrCreate(userId: string): Promise<UserPreference> {
    this.ensureUserId(userId);
    let pref = await this.prefRepo.findOne({ where: { userId } });
    if (!pref) {
      pref = await this.createDefaultPreferences(userId);
    }
    return pref;
  }

  private ensureUserId(userId: string) {
    if (!userId || !validateUuid(userId)) {
      throw new BadRequestException('Invalid user id');
    }
  }

  private async createDefaultPreferences(userId: string): Promise<UserPreference> {
    const pref = this.prefRepo.create({
      userId,
      densityMode: 'comfortable',
      sidebarPosition: 'left',
      sidebarCollapsed: false,
      sidebarWidth: 260,
      showBreadcrumbs: true,
      showFooter: true,
      contentWidth: 'full',
      pinnedNavigation: [],
      recentItemsCount: 5,
      showFavoritesInSidebar: true,
      showRecentInSidebar: true,
      language: 'en',
      dateFormat: 'MM/DD/YYYY',
      timeFormat: '12h',
      startOfWeek: 'sunday',
      numberFormat: 'en-US',
      notificationPreferences: {
        email: { enabled: true, frequency: 'daily', categories: [] },
        inApp: { enabled: true, sound: true, showPreview: true },
        push: { enabled: false },
      },
      accessibility: {
        reduceMotion: false,
        highContrast: false,
        largeText: false,
        screenReaderOptimized: false,
        keyboardNavigation: true,
        focusIndicators: true,
      },
      keyboardShortcutsEnabled: true,
      customShortcuts: [],
      tablePreferences: {
        defaultPageSize: 25,
        showRowNumbers: false,
        enableColumnReorder: true,
        stickyHeader: true,
        alternateRowColors: false,
        compactMode: false,
      },
      dashboardPreferences: {
        autoRefreshInterval: 0,
        showWelcomeWidget: true,
      },
      autoSaveEnabled: true,
      autoSaveInterval: 30,
      confirmBeforeLeave: true,
      showFieldDescriptions: true,
      searchIncludeArchived: false,
      searchResultsPerPage: 20,
      searchHighlightMatches: true,
      avaEnabled: true,
      avaAutoSuggest: true,
      avaVoiceEnabled: false,
      syncEnabled: true,
      preferenceVersion: 1,
    });

    return this.prefRepo.save(pref);
  }

  private normalizePositions(
    items: PinnedNavigationItem[],
  ): PinnedNavigationItem[] {
    return items
      .sort((a, b) => a.position - b.position)
      .map((item, index) => ({ ...item, position: index }));
  }

  private toResponse(pref: UserPreference): UserPreferencesResponse {
    return {
      id: pref.id,
      userId: pref.userId,
      densityMode: pref.densityMode,
      sidebarPosition: pref.sidebarPosition,
      sidebarCollapsed: pref.sidebarCollapsed,
      sidebarWidth: pref.sidebarWidth,
      showBreadcrumbs: pref.showBreadcrumbs,
      showFooter: pref.showFooter,
      contentWidth: pref.contentWidth,
      pinnedNavigation: pref.pinnedNavigation,
      recentItemsCount: pref.recentItemsCount,
      showFavoritesInSidebar: pref.showFavoritesInSidebar,
      showRecentInSidebar: pref.showRecentInSidebar,
      language: pref.language,
      timezone: pref.timezone,
      dateFormat: pref.dateFormat,
      timeFormat: pref.timeFormat,
      startOfWeek: pref.startOfWeek,
      numberFormat: pref.numberFormat,
      notificationPreferences: pref.notificationPreferences,
      accessibility: pref.accessibility,
      keyboardShortcutsEnabled: pref.keyboardShortcutsEnabled,
      customShortcuts: pref.customShortcuts,
      tablePreferences: pref.tablePreferences,
      dashboardPreferences: pref.dashboardPreferences,
      autoSaveEnabled: pref.autoSaveEnabled,
      autoSaveInterval: pref.autoSaveInterval,
      confirmBeforeLeave: pref.confirmBeforeLeave,
      showFieldDescriptions: pref.showFieldDescriptions,
      searchIncludeArchived: pref.searchIncludeArchived,
      searchResultsPerPage: pref.searchResultsPerPage,
      searchHighlightMatches: pref.searchHighlightMatches,
      homePage: pref.homePage,
      startupPage: pref.startupPage,
      avaEnabled: pref.avaEnabled,
      avaAutoSuggest: pref.avaAutoSuggest,
      avaVoiceEnabled: pref.avaVoiceEnabled,
      syncEnabled: pref.syncEnabled,
      preferenceVersion: pref.preferenceVersion,
      createdAt: pref.createdAt,
      updatedAt: pref.updatedAt,
    };
  }
}
