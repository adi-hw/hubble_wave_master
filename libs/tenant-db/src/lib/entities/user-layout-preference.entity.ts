import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export type LayoutType = 'list' | 'form' | 'dashboard' | 'report' | 'kanban' | 'calendar' | 'timeline';
export type PreferenceScope = 'user' | 'role' | 'group' | 'tenant';

/**
 * Stores user-level UI layout preferences (the third tier of customization).
 * Allows users to personalize their view of tables, forms, dashboards without affecting other users.
 */
@Entity('user_layout_preference')
@Index(['tenantId', 'userId', 'layoutType', 'resourceKey'], { unique: true })
@Index(['tenantId', 'userId'])
@Index(['resourceKey', 'layoutType'])
export class UserLayoutPreference {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'layout_type', type: 'varchar', length: 30 })
  layoutType!: LayoutType;

  @Column({ name: 'resource_key', type: 'varchar', length: 255 })
  resourceKey!: string; // e.g., 'asset', 'work_order', 'dashboard_main'

  /**
   * Column visibility and order for list views.
   */
  @Column({ name: 'column_config', type: 'jsonb', nullable: true })
  columnConfig?: ColumnConfig;

  /**
   * Saved filters that can be quickly applied.
   */
  @Column({ name: 'saved_filters', type: 'jsonb', nullable: true })
  savedFilters?: SavedFilter[];

  /**
   * Default filter to apply when loading the view.
   */
  @Column({ name: 'default_filter_id', type: 'varchar', length: 100, nullable: true })
  defaultFilterId?: string;

  /**
   * Default sort configuration.
   */
  @Column({ name: 'sort_config', type: 'jsonb', nullable: true })
  sortConfig?: SortConfig;

  /**
   * Form section collapse/expand state.
   */
  @Column({ name: 'form_sections', type: 'jsonb', nullable: true })
  formSections?: FormSectionState[];

  /**
   * Dashboard widget layout and configuration.
   */
  @Column({ name: 'dashboard_layout', type: 'jsonb', nullable: true })
  dashboardLayout?: DashboardLayout;

  /**
   * Kanban board column configuration.
   */
  @Column({ name: 'kanban_config', type: 'jsonb', nullable: true })
  kanbanConfig?: KanbanConfig;

  /**
   * Calendar view preferences.
   */
  @Column({ name: 'calendar_config', type: 'jsonb', nullable: true })
  calendarConfig?: CalendarConfig;

  /**
   * Page size preference for lists.
   */
  @Column({ name: 'page_size', type: 'int', nullable: true })
  pageSize?: number;

  /**
   * View density preference.
   */
  @Column({ name: 'density', type: 'varchar', length: 20, nullable: true })
  density?: 'compact' | 'comfortable' | 'spacious';

  /**
   * Whether this preference is pinned/starred by the user.
   */
  @Column({ name: 'is_pinned', type: 'boolean', default: false })
  isPinned!: boolean;

  /**
   * Last time this view was accessed (for recently used sorting).
   */
  @Column({ name: 'last_accessed_at', type: 'timestamptz', nullable: true })
  lastAccessedAt?: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

// Supporting interfaces
export interface ColumnConfig {
  columns: ColumnSetting[];
  frozenColumns?: string[]; // Column IDs that are frozen/pinned
}

export interface ColumnSetting {
  fieldId: string;
  visible: boolean;
  width?: number;
  order: number;
}

export interface SavedFilter {
  id: string;
  name: string;
  conditions: FilterCondition[];
  isDefault?: boolean;
  color?: string;
  icon?: string;
}

export interface FilterCondition {
  field: string;
  operator: string;
  value: any;
  logicalOperator?: 'and' | 'or';
}

export interface SortConfig {
  field: string;
  direction: 'asc' | 'desc';
  secondary?: {
    field: string;
    direction: 'asc' | 'desc';
  };
}

export interface FormSectionState {
  sectionId: string;
  collapsed: boolean;
}

export interface DashboardLayout {
  widgets: DashboardWidget[];
  gridCols?: number;
}

export interface DashboardWidget {
  widgetId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  config?: Record<string, any>;
}

export interface KanbanConfig {
  groupByField: string;
  swimlaneField?: string;
  cardFields: string[];
  columnOrder?: string[];
  columnWidths?: Record<string, number>;
  wipLimits?: Record<string, number>;
}

export interface CalendarConfig {
  defaultView: 'month' | 'week' | 'day' | 'agenda';
  startField: string;
  endField?: string;
  titleField: string;
  colorField?: string;
  showWeekends?: boolean;
  firstDayOfWeek?: number; // 0 = Sunday, 1 = Monday
}
