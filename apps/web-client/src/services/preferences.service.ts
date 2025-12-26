import { createApiClient } from './api';

// ============================================================================
// Types
// ============================================================================

export type DensityMode = 'compact' | 'comfortable' | 'spacious';
export type SidebarPosition = 'left' | 'right';
export type DateFormat = 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD' | 'DD.MM.YYYY';
export type TimeFormat = '12h' | '24h';
export type StartOfWeek = 'sunday' | 'monday' | 'saturday';
export type NotificationFrequency = 'realtime' | 'hourly' | 'daily' | 'weekly' | 'never';

export interface PinnedNavigationItem {
  id: string;
  type: 'collection' | 'view' | 'module' | 'link';
  code: string;
  label: string;
  icon?: string;
  route?: string;
  position: number;
}

export interface KeyboardShortcut {
  action: string;
  keys: string;
  enabled: boolean;
}

export interface NotificationPreferences {
  email: {
    enabled: boolean;
    frequency: NotificationFrequency;
    categories: string[];
  };
  inApp: {
    enabled: boolean;
    sound: boolean;
    showPreview: boolean;
  };
  push: {
    enabled: boolean;
  };
}

export interface AccessibilitySettings {
  reduceMotion: boolean;
  highContrast: boolean;
  largeText: boolean;
  screenReaderOptimized: boolean;
  keyboardNavigation: boolean;
  focusIndicators: boolean;
}

export interface TablePreferences {
  defaultPageSize: number;
  showRowNumbers: boolean;
  enableColumnReorder: boolean;
  stickyHeader: boolean;
  alternateRowColors: boolean;
  compactMode: boolean;
}

export interface DashboardPreferences {
  defaultDashboard?: string;
  autoRefreshInterval: number;
  showWelcomeWidget: boolean;
}

export interface UserPreferences {
  id: string;
  userId: string;
  // Layout & Display
  densityMode: DensityMode;
  sidebarPosition: SidebarPosition;
  sidebarCollapsed: boolean;
  sidebarWidth: number;
  showBreadcrumbs: boolean;
  showFooter: boolean;
  contentWidth: 'full' | 'wide' | 'narrow';
  // Navigation
  pinnedNavigation: PinnedNavigationItem[];
  recentItemsCount: number;
  showFavoritesInSidebar: boolean;
  showRecentInSidebar: boolean;
  // Locale & Regional
  language: string;
  timezone?: string;
  dateFormat: DateFormat;
  timeFormat: TimeFormat;
  startOfWeek: StartOfWeek;
  numberFormat: string;
  // Notifications
  notificationPreferences: NotificationPreferences;
  // Accessibility
  accessibility: AccessibilitySettings;
  // Keyboard Shortcuts
  keyboardShortcutsEnabled: boolean;
  customShortcuts: KeyboardShortcut[];
  // Table Preferences
  tablePreferences: TablePreferences;
  // Dashboard Preferences
  dashboardPreferences: DashboardPreferences;
  // Editor Preferences
  autoSaveEnabled: boolean;
  autoSaveInterval: number;
  confirmBeforeLeave: boolean;
  showFieldDescriptions: boolean;
  // Search Preferences
  searchIncludeArchived: boolean;
  searchResultsPerPage: number;
  searchHighlightMatches: boolean;
  // Home Page
  homePage?: string;
  startupPage?: string;
  // AVA Preferences
  avaEnabled: boolean;
  avaAutoSuggest: boolean;
  avaVoiceEnabled: boolean;
  // Sync
  syncEnabled: boolean;
  preferenceVersion: number;
  createdAt: string;
  updatedAt: string;
}

export type UpdateUserPreferencesDto = Partial<Omit<UserPreferences, 'id' | 'userId' | 'preferenceVersion' | 'createdAt' | 'updatedAt'>>;

export interface AddPinnedItemDto {
  type: 'collection' | 'view' | 'module' | 'link';
  code: string;
  label: string;
  icon?: string;
  route?: string;
  position?: number;
}

export interface SyncResult {
  preferences: UserPreferences;
  hasChanges: boolean;
  currentVersion: number;
}

export interface PreferenceVersion {
  version: number;
  lastSyncedAt?: string;
  lastSyncDevice?: string;
}

// ============================================================================
// API Client
// ============================================================================

const METADATA_API_URL = import.meta.env.VITE_METADATA_API_URL ?? '/api/metadata';
const api = createApiClient(METADATA_API_URL);

// ============================================================================
// Default Preferences (for offline/fallback)
// ============================================================================

export const defaultPreferences: Omit<UserPreferences, 'id' | 'userId' | 'preferenceVersion' | 'createdAt' | 'updatedAt'> = {
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
};

// ============================================================================
// Service
// ============================================================================

export const preferencesService = {
  // Main Preferences
  async getPreferences(): Promise<UserPreferences> {
    const res = await api.get<UserPreferences>('/preferences/me');
    return res.data;
  },

  async updatePreferences(dto: UpdateUserPreferencesDto): Promise<UserPreferences> {
    const res = await api.put<UserPreferences>('/preferences/me', dto);
    return res.data;
  },

  async patchPreferences(dto: Partial<UpdateUserPreferencesDto>): Promise<UserPreferences> {
    const res = await api.patch<UserPreferences>('/preferences/me', dto);
    return res.data;
  },

  async resetPreferences(): Promise<UserPreferences> {
    const res = await api.post<UserPreferences>('/preferences/me/reset');
    return res.data;
  },

  // Pinned Navigation
  async getPinnedNavigation(): Promise<PinnedNavigationItem[]> {
    const res = await api.get<{ data: PinnedNavigationItem[] }>('/preferences/me/pinned');
    return res.data.data;
  },

  async addPinnedItem(dto: AddPinnedItemDto): Promise<PinnedNavigationItem[]> {
    const res = await api.post<{ data: PinnedNavigationItem[] }>('/preferences/me/pinned', dto);
    return res.data.data;
  },

  async updatePinnedItem(itemId: string, dto: { label?: string; icon?: string; position?: number }): Promise<PinnedNavigationItem[]> {
    const res = await api.put<{ data: PinnedNavigationItem[] }>(`/preferences/me/pinned/${itemId}`, dto);
    return res.data.data;
  },

  async removePinnedItem(itemId: string): Promise<PinnedNavigationItem[]> {
    const res = await api.delete<{ data: PinnedNavigationItem[] }>(`/preferences/me/pinned/${itemId}`);
    return res.data.data;
  },

  async reorderPinnedItems(order: string[]): Promise<PinnedNavigationItem[]> {
    const res = await api.post<{ data: PinnedNavigationItem[] }>('/preferences/me/pinned/reorder', { order });
    return res.data.data;
  },

  // Quick Actions
  async setDensityMode(mode: DensityMode): Promise<UserPreferences> {
    const res = await api.put<UserPreferences>(`/preferences/me/density/${mode}`);
    return res.data;
  },

  async setSidebarPosition(position: SidebarPosition): Promise<UserPreferences> {
    const res = await api.put<UserPreferences>(`/preferences/me/sidebar/position/${position}`);
    return res.data;
  },

  async toggleSidebarCollapsed(): Promise<UserPreferences> {
    const res = await api.post<UserPreferences>('/preferences/me/sidebar/toggle');
    return res.data;
  },

  // Sync
  async syncPreferences(deviceId: string, fromVersion?: number): Promise<SyncResult> {
    const res = await api.post<SyncResult>('/preferences/me/sync', { deviceId, fromVersion });
    return res.data;
  },

  async getPreferenceVersion(): Promise<PreferenceVersion> {
    const res = await api.get<PreferenceVersion>('/preferences/me/version');
    return res.data;
  },
};
