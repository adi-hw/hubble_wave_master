import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from './user.entity';

// ============================================================================
// TYPES & ENUMS
// ============================================================================

export type DensityMode = 'compact' | 'comfortable' | 'spacious';
export type SidebarPosition = 'left' | 'right';
export type DateFormat = 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD' | 'DD.MM.YYYY';
export type TimeFormat = '12h' | '24h';
export type StartOfWeek = 'sunday' | 'monday' | 'saturday';
export type NotificationFrequency = 'realtime' | 'hourly' | 'daily' | 'weekly' | 'never';

// ============================================================================
// INTERFACES
// ============================================================================

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
  keys: string; // e.g., "ctrl+s", "cmd+shift+n"
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
  autoRefreshInterval: number; // in seconds, 0 = disabled
  showWelcomeWidget: boolean;
}

// ============================================================================
// ENTITY
// ============================================================================

@Entity('user_preferences')
@Index(['userId'], { unique: true })
export class UserPreference {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  // ─────────────────────────────────────────────────────────────────
  // Layout & Display
  // ─────────────────────────────────────────────────────────────────

  @Column({
    name: 'density_mode',
    type: 'varchar',
    length: 20,
    default: 'comfortable',
  })
  densityMode!: DensityMode;

  @Column({
    name: 'sidebar_position',
    type: 'varchar',
    length: 10,
    default: 'left',
  })
  sidebarPosition!: SidebarPosition;

  @Column({ name: 'sidebar_collapsed', type: 'boolean', default: false })
  sidebarCollapsed!: boolean;

  @Column({ name: 'sidebar_width', type: 'integer', default: 260 })
  sidebarWidth!: number;

  @Column({ name: 'show_breadcrumbs', type: 'boolean', default: true })
  showBreadcrumbs!: boolean;

  @Column({ name: 'show_footer', type: 'boolean', default: true })
  showFooter!: boolean;

  @Column({ name: 'content_width', type: 'varchar', length: 20, default: 'full' })
  contentWidth!: 'full' | 'wide' | 'narrow';

  // ─────────────────────────────────────────────────────────────────
  // Navigation
  // ─────────────────────────────────────────────────────────────────

  @Column({
    name: 'pinned_navigation',
    type: 'jsonb',
    default: [],
  })
  pinnedNavigation!: PinnedNavigationItem[];

  @Column({
    name: 'recent_items_count',
    type: 'integer',
    default: 5,
  })
  recentItemsCount!: number;

  @Column({ name: 'show_favorites_in_sidebar', type: 'boolean', default: true })
  showFavoritesInSidebar!: boolean;

  @Column({ name: 'show_recent_in_sidebar', type: 'boolean', default: true })
  showRecentInSidebar!: boolean;

  // ─────────────────────────────────────────────────────────────────
  // Locale & Regional
  // ─────────────────────────────────────────────────────────────────

  @Column({ type: 'varchar', length: 10, default: 'en' })
  language!: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  timezone?: string;

  @Column({
    name: 'date_format',
    type: 'varchar',
    length: 20,
    default: 'MM/DD/YYYY',
  })
  dateFormat!: DateFormat;

  @Column({
    name: 'time_format',
    type: 'varchar',
    length: 5,
    default: '12h',
  })
  timeFormat!: TimeFormat;

  @Column({
    name: 'start_of_week',
    type: 'varchar',
    length: 10,
    default: 'sunday',
  })
  startOfWeek!: StartOfWeek;

  @Column({
    name: 'number_format',
    type: 'varchar',
    length: 20,
    default: 'en-US',
  })
  numberFormat!: string;

  // ─────────────────────────────────────────────────────────────────
  // Notifications
  // ─────────────────────────────────────────────────────────────────

  @Column({
    name: 'notification_preferences',
    type: 'jsonb',
    default: {
      email: { enabled: true, frequency: 'daily', categories: [] },
      inApp: { enabled: true, sound: true, showPreview: true },
      push: { enabled: false },
    },
  })
  notificationPreferences!: NotificationPreferences;

  // ─────────────────────────────────────────────────────────────────
  // Accessibility
  // ─────────────────────────────────────────────────────────────────

  @Column({
    name: 'accessibility',
    type: 'jsonb',
    default: {
      reduceMotion: false,
      highContrast: false,
      largeText: false,
      screenReaderOptimized: false,
      keyboardNavigation: true,
      focusIndicators: true,
    },
  })
  accessibility!: AccessibilitySettings;

  // ─────────────────────────────────────────────────────────────────
  // Keyboard Shortcuts
  // ─────────────────────────────────────────────────────────────────

  @Column({
    name: 'keyboard_shortcuts_enabled',
    type: 'boolean',
    default: true,
  })
  keyboardShortcutsEnabled!: boolean;

  @Column({
    name: 'custom_shortcuts',
    type: 'jsonb',
    default: [],
  })
  customShortcuts!: KeyboardShortcut[];

  // ─────────────────────────────────────────────────────────────────
  // Table & List Preferences
  // ─────────────────────────────────────────────────────────────────

  @Column({
    name: 'table_preferences',
    type: 'jsonb',
    default: {
      defaultPageSize: 25,
      showRowNumbers: false,
      enableColumnReorder: true,
      stickyHeader: true,
      alternateRowColors: false,
      compactMode: false,
    },
  })
  tablePreferences!: TablePreferences;

  // ─────────────────────────────────────────────────────────────────
  // Dashboard Preferences
  // ─────────────────────────────────────────────────────────────────

  @Column({
    name: 'dashboard_preferences',
    type: 'jsonb',
    default: {
      autoRefreshInterval: 0,
      showWelcomeWidget: true,
    },
  })
  dashboardPreferences!: DashboardPreferences;

  // ─────────────────────────────────────────────────────────────────
  // Editor Preferences
  // ─────────────────────────────────────────────────────────────────

  @Column({ name: 'auto_save_enabled', type: 'boolean', default: true })
  autoSaveEnabled!: boolean;

  @Column({ name: 'auto_save_interval', type: 'integer', default: 30 })
  autoSaveInterval!: number; // in seconds

  @Column({ name: 'confirm_before_leave', type: 'boolean', default: true })
  confirmBeforeLeave!: boolean;

  @Column({ name: 'show_field_descriptions', type: 'boolean', default: true })
  showFieldDescriptions!: boolean;

  // ─────────────────────────────────────────────────────────────────
  // Search Preferences
  // ─────────────────────────────────────────────────────────────────

  @Column({ name: 'search_include_archived', type: 'boolean', default: false })
  searchIncludeArchived!: boolean;

  @Column({ name: 'search_results_per_page', type: 'integer', default: 20 })
  searchResultsPerPage!: number;

  @Column({ name: 'search_highlight_matches', type: 'boolean', default: true })
  searchHighlightMatches!: boolean;

  // ─────────────────────────────────────────────────────────────────
  // Home Page
  // ─────────────────────────────────────────────────────────────────

  @Column({ name: 'home_page', type: 'varchar', length: 255, nullable: true })
  homePage?: string;

  @Column({ name: 'startup_page', type: 'varchar', length: 255, nullable: true })
  startupPage?: string;

  // ─────────────────────────────────────────────────────────────────
  // AVA Preferences
  // ─────────────────────────────────────────────────────────────────

  @Column({ name: 'ava_enabled', type: 'boolean', default: true })
  avaEnabled!: boolean;

  @Column({ name: 'ava_auto_suggest', type: 'boolean', default: true })
  avaAutoSuggest!: boolean;

  @Column({ name: 'ava_voice_enabled', type: 'boolean', default: false })
  avaVoiceEnabled!: boolean;

  // ─────────────────────────────────────────────────────────────────
  // Sync & Device
  // ─────────────────────────────────────────────────────────────────

  @Column({ name: 'sync_enabled', type: 'boolean', default: true })
  syncEnabled!: boolean;

  @Column({ name: 'last_sync_device', type: 'varchar', length: 255, nullable: true })
  lastSyncDevice?: string;

  @Column({ name: 'last_synced_at', type: 'timestamptz', nullable: true })
  lastSyncedAt?: Date;

  @Column({ name: 'preference_version', type: 'integer', default: 1 })
  preferenceVersion!: number;

  // ─────────────────────────────────────────────────────────────────
  // Timestamps
  // ─────────────────────────────────────────────────────────────────

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
