import {
  IsString,
  IsBoolean,
  IsOptional,
  IsInt,
  Min,
  Max,
  IsIn,
  IsArray,
  ValidateNested,
  IsObject,
  IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  DensityMode,
  SidebarPosition,
  DateFormat,
  TimeFormat,
  StartOfWeek,
  PinnedNavigationItem,
  NotificationPreferences,
  AccessibilitySettings,
  TablePreferences,
  DashboardPreferences,
  KeyboardShortcut,
} from '@hubblewave/instance-db';

// ============================================================================
// Pinned Navigation Item DTO
// ============================================================================

export class PinnedNavigationItemDto implements PinnedNavigationItem {
  @IsUUID()
  id!: string;

  @IsString()
  @IsIn(['collection', 'view', 'module', 'link'])
  type!: 'collection' | 'view' | 'module' | 'link';

  @IsString()
  code!: string;

  @IsString()
  label!: string;

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  @IsString()
  route?: string;

  @IsInt()
  @Min(0)
  position!: number;
}

// ============================================================================
// Update User Preferences DTO
// ============================================================================

export class UpdateUserPreferencesDto {
  // Layout & Display
  @IsOptional()
  @IsString()
  @IsIn(['compact', 'comfortable', 'spacious'])
  densityMode?: DensityMode;

  @IsOptional()
  @IsString()
  @IsIn(['left', 'right'])
  sidebarPosition?: SidebarPosition;

  @IsOptional()
  @IsBoolean()
  sidebarCollapsed?: boolean;

  @IsOptional()
  @IsInt()
  @Min(200)
  @Max(400)
  sidebarWidth?: number;

  @IsOptional()
  @IsBoolean()
  showBreadcrumbs?: boolean;

  @IsOptional()
  @IsBoolean()
  showFooter?: boolean;

  @IsOptional()
  @IsString()
  @IsIn(['full', 'wide', 'narrow'])
  contentWidth?: 'full' | 'wide' | 'narrow';

  // Navigation
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PinnedNavigationItemDto)
  pinnedNavigation?: PinnedNavigationItem[];

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(20)
  recentItemsCount?: number;

  @IsOptional()
  @IsBoolean()
  showFavoritesInSidebar?: boolean;

  @IsOptional()
  @IsBoolean()
  showRecentInSidebar?: boolean;

  // Locale & Regional
  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsString()
  @IsIn(['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD', 'DD.MM.YYYY'])
  dateFormat?: DateFormat;

  @IsOptional()
  @IsString()
  @IsIn(['12h', '24h'])
  timeFormat?: TimeFormat;

  @IsOptional()
  @IsString()
  @IsIn(['sunday', 'monday', 'saturday'])
  startOfWeek?: StartOfWeek;

  @IsOptional()
  @IsString()
  numberFormat?: string;

  // Notifications
  @IsOptional()
  @IsObject()
  notificationPreferences?: NotificationPreferences;

  // Accessibility
  @IsOptional()
  @IsObject()
  accessibility?: AccessibilitySettings;

  // Keyboard Shortcuts
  @IsOptional()
  @IsBoolean()
  keyboardShortcutsEnabled?: boolean;

  @IsOptional()
  @IsArray()
  customShortcuts?: KeyboardShortcut[];

  // Table Preferences
  @IsOptional()
  @IsObject()
  tablePreferences?: TablePreferences;

  // Dashboard Preferences
  @IsOptional()
  @IsObject()
  dashboardPreferences?: DashboardPreferences;

  // Editor Preferences
  @IsOptional()
  @IsBoolean()
  autoSaveEnabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(300)
  autoSaveInterval?: number;

  @IsOptional()
  @IsBoolean()
  confirmBeforeLeave?: boolean;

  @IsOptional()
  @IsBoolean()
  showFieldDescriptions?: boolean;

  // Search Preferences
  @IsOptional()
  @IsBoolean()
  searchIncludeArchived?: boolean;

  @IsOptional()
  @IsInt()
  @Min(10)
  @Max(100)
  searchResultsPerPage?: number;

  @IsOptional()
  @IsBoolean()
  searchHighlightMatches?: boolean;

  // Home Page
  @IsOptional()
  @IsString()
  homePage?: string;

  @IsOptional()
  @IsString()
  startupPage?: string;

  // AVA Preferences
  @IsOptional()
  @IsBoolean()
  avaEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  avaAutoSuggest?: boolean;

  @IsOptional()
  @IsBoolean()
  avaVoiceEnabled?: boolean;

  // Sync
  @IsOptional()
  @IsBoolean()
  syncEnabled?: boolean;
}

// ============================================================================
// Add Pinned Item DTO
// ============================================================================

export class AddPinnedItemDto {
  @IsString()
  @IsIn(['collection', 'view', 'module', 'link'])
  type!: 'collection' | 'view' | 'module' | 'link';

  @IsString()
  code!: string;

  @IsString()
  label!: string;

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  @IsString()
  route?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;
}

// ============================================================================
// Update Pinned Item DTO
// ============================================================================

export class UpdatePinnedItemDto {
  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;
}

// ============================================================================
// Reorder Pinned Items DTO
// ============================================================================

export class ReorderPinnedItemsDto {
  @IsArray()
  @IsUUID('4', { each: true })
  order!: string[];
}

// ============================================================================
// Sync Preferences DTO
// ============================================================================

export class SyncPreferencesDto {
  @IsString()
  deviceId!: string;

  @IsOptional()
  @IsString()
  deviceName?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  fromVersion?: number;
}

// ============================================================================
// Response Types
// ============================================================================

export interface UserPreferencesResponse {
  id: string;
  userId: string;
  densityMode: DensityMode;
  sidebarPosition: SidebarPosition;
  sidebarCollapsed: boolean;
  sidebarWidth: number;
  showBreadcrumbs: boolean;
  showFooter: boolean;
  contentWidth: 'full' | 'wide' | 'narrow';
  pinnedNavigation: PinnedNavigationItem[];
  recentItemsCount: number;
  showFavoritesInSidebar: boolean;
  showRecentInSidebar: boolean;
  language: string;
  timezone?: string;
  dateFormat: DateFormat;
  timeFormat: TimeFormat;
  startOfWeek: StartOfWeek;
  numberFormat: string;
  notificationPreferences: NotificationPreferences;
  accessibility: AccessibilitySettings;
  keyboardShortcutsEnabled: boolean;
  customShortcuts: KeyboardShortcut[];
  tablePreferences: TablePreferences;
  dashboardPreferences: DashboardPreferences;
  autoSaveEnabled: boolean;
  autoSaveInterval: number;
  confirmBeforeLeave: boolean;
  showFieldDescriptions: boolean;
  searchIncludeArchived: boolean;
  searchResultsPerPage: number;
  searchHighlightMatches: boolean;
  homePage?: string;
  startupPage?: string;
  avaEnabled: boolean;
  avaAutoSuggest: boolean;
  avaVoiceEnabled: boolean;
  syncEnabled: boolean;
  preferenceVersion: number;
  createdAt: Date;
  updatedAt: Date;
}
