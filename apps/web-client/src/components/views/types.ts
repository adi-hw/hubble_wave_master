/**
 * View System Types
 * HubbleWave Platform - Phase 1
 *
 * Unified type definitions for all view types: List, Kanban, Calendar, Gallery
 */

import type { ViewType as SharedViewType } from '@hubblewave/shared-types';
import { TableColumn, FilterGroup } from '../table/types';

// ============================================================================
// View Types
// ============================================================================

export type ViewType = SharedViewType;

export interface ViewAppearance {
  density?: 'compact' | 'normal' | 'comfortable';
  showGridLines?: boolean;
  alternateRowColors?: boolean;
  headerStyle?: 'default' | 'bold' | 'colored';
  accentColor?: string;
}

export interface BaseViewConfig {
  id: string;
  name: string;
  type: ViewType;
  collectionCode: string;
  isDefault?: boolean;
  isPersonal?: boolean;
  ownerId?: string;
  filters?: FilterGroup;
  filterLogic?: 'and' | 'or';
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  appearance?: ViewAppearance;
  createdAt?: string;
  updatedAt?: string;
}

// ============================================================================
// List View
// ============================================================================

export interface ListViewConfig extends BaseViewConfig {
  type: 'list';
  columns: TableColumn[];
  pageSize?: number;
  showRowNumbers?: boolean;
  enableInlineEdit?: boolean;
}

// ============================================================================
// Kanban View
// ============================================================================

export interface KanbanLane {
  id: string;
  title: string;
  value: string | null; // null for "No value" lane
  color?: string;
  wipLimit?: number;
  collapsed?: boolean;
}

export interface KanbanCard {
  id: string;
  title: string;
  subtitle?: string;
  coverImage?: string;
  color?: string;
  labels?: { text: string; color: string }[];
  dueDate?: string;
  assignees?: { id: string; name: string; avatar?: string }[];
  // Original record data
  record: Record<string, any>;
}

export interface KanbanViewConfig extends BaseViewConfig {
  type: 'kanban';
  groupByProperty: string;
  lanes: KanbanLane[];
  titleProperty: string;
  subtitleProperty?: string;
  coverImageProperty?: string;
  colorProperty?: string;
  labelProperties?: string[];
  dueDateProperty?: string;
  assigneeProperty?: string;
  cardProperties?: string[]; // Additional properties to show on card
  hideEmptyLanes?: boolean;
  enableWipLimits?: boolean;
}

// ============================================================================
// Calendar View
// ============================================================================

export type CalendarViewMode = 'month' | 'week' | 'day' | 'agenda';

export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end?: Date;
  allDay?: boolean;
  color?: string;
  resource?: any;
  // Original record data
  record: Record<string, any>;
}

export interface CalendarViewConfig extends BaseViewConfig {
  type: 'calendar';
  titleProperty: string;
  startDateProperty: string;
  endDateProperty?: string;
  allDayProperty?: string;
  colorProperty?: string;
  defaultViewMode?: CalendarViewMode;
  weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6; // Sunday = 0
  showWeekNumbers?: boolean;
  enableDragDrop?: boolean;
}

// ============================================================================
// Gallery View
// ============================================================================

export type GalleryCardSize = 'small' | 'medium' | 'large';

export interface GalleryCard {
  id: string;
  title: string;
  subtitle?: string;
  coverImage?: string;
  properties: { label: string; value: any; type: string }[];
  // Original record data
  record: Record<string, any>;
}

export interface GalleryViewConfig extends BaseViewConfig {
  type: 'gallery';
  titleProperty: string;
  subtitleProperty?: string;
  coverImageProperty?: string;
  cardProperties: string[];
  cardSize?: GalleryCardSize;
  columnsPerRow?: number; // Auto-calculated if not set
  aspectRatio?: '1:1' | '4:3' | '16:9' | 'auto';
  showPropertyLabels?: boolean;
  enableLightbox?: boolean;
}

// ============================================================================
// Timeline View (Future - Phase 2)
// ============================================================================

export interface TimelineViewConfig extends BaseViewConfig {
  type: 'timeline';
  titleProperty: string;
  startDateProperty: string;
  endDateProperty?: string;
  colorProperty?: string;
  groupByProperty?: string;
  zoomLevel?: 'day' | 'week' | 'month' | 'quarter' | 'year';
}

// ============================================================================
// Pivot View (Phase 2)
// ============================================================================

export type PivotAggregation = 'sum' | 'avg' | 'count' | 'min' | 'max' | 'first' | 'last';

export interface PivotDimension {
  property: string;
  label?: string;
  sortDir?: 'asc' | 'desc';
}

export interface PivotMeasure {
  property: string;
  label?: string;
  aggregation: PivotAggregation;
  format?: 'number' | 'currency' | 'percent';
}

export interface PivotViewConfig extends BaseViewConfig {
  type: 'pivot';
  rows: PivotDimension[];
  columns: PivotDimension[];
  measures: PivotMeasure[];
  showTotals?: boolean;
  showSubtotals?: boolean;
  expandedRows?: string[];
  expandedColumns?: string[];
  pivotLayout?: 'compact' | 'tabular' | 'outline';
  enableDrillDown?: boolean;
}

// ============================================================================
// Gantt View (Phase 2)
// ============================================================================

export interface GanttTask {
  id: string;
  title: string;
  start: Date;
  end: Date;
  progress?: number;
  dependencies?: string[];
  parentId?: string;
  color?: string;
  assignees?: { id: string; name: string; avatar?: string }[];
  record: Record<string, any>;
}

export interface GanttViewConfig extends BaseViewConfig {
  type: 'gantt';
  titleProperty: string;
  startDateProperty: string;
  endDateProperty: string;
  progressProperty?: string;
  dependencyProperty?: string;
  parentProperty?: string;
  colorProperty?: string;
  assigneeProperty?: string;
  defaultZoom?: 'day' | 'week' | 'month' | 'quarter' | 'year';
  showDependencies?: boolean;
  enableDragDrop?: boolean;
  showProgress?: boolean;
  showCriticalPath?: boolean;
}

// ============================================================================
// Map View (Phase 2)
// ============================================================================

export interface MapMarker {
  id: string;
  title: string;
  latitude: number;
  longitude: number;
  color?: string;
  icon?: string;
  properties: Record<string, any>;
  record: Record<string, any>;
}

export interface MapViewConfig extends BaseViewConfig {
  type: 'map';
  titleProperty: string;
  latitudeProperty: string;
  longitudeProperty: string;
  colorProperty?: string;
  iconProperty?: string;
  popupProperties?: string[];
  clusterMarkers?: boolean;
  clusterRadius?: number;
  defaultCenter?: { lat: number; lng: number };
  defaultZoom?: number;
  mapStyle?: 'roadmap' | 'satellite' | 'terrain' | 'hybrid';
  enableSearch?: boolean;
  enableGeocoding?: boolean;
}

// ============================================================================
// View Union Type
// ============================================================================

export type ViewConfig =
  | ListViewConfig
  | KanbanViewConfig
  | CalendarViewConfig
  | GalleryViewConfig
  | TimelineViewConfig
  | PivotViewConfig
  | GanttViewConfig
  | MapViewConfig;

// ============================================================================
// View Context
// ============================================================================

export interface ViewContextValue {
  currentView: ViewConfig | null;
  availableViews: ViewConfig[];
  switchView: (viewId: string) => void;
  createView: (config: Omit<ViewConfig, 'id'>) => Promise<ViewConfig>;
  updateView: (id: string, updates: Partial<ViewConfig>) => Promise<void>;
  deleteView: (id: string) => Promise<void>;
  duplicateView: (id: string) => Promise<ViewConfig>;
}

// ============================================================================
// Drag and Drop Types
// ============================================================================

export interface DragItem {
  type: 'card';
  id: string;
  sourceIndex: number;
  sourceLaneId: string;
}

export interface DropResult {
  destination: {
    laneId: string;
    index: number;
  } | null;
  source: {
    laneId: string;
    index: number;
  };
  draggableId: string;
}

// ============================================================================
// View Toolbar Props
// ============================================================================

export interface ViewToolbarProps {
  currentView: ViewConfig;
  availableViews: ViewConfig[];
  onViewChange: (viewId: string) => void;
  onCreateView: () => void;
  onEditView: () => void;
  onDeleteView: () => void;
  onDuplicateView: () => void;
}

// ============================================================================
// Common View Props
// ============================================================================

export interface BaseViewProps<T extends BaseViewConfig> {
  config: T;
  data: Record<string, any>[];
  loading?: boolean;
  error?: string | null;
  onRecordClick?: (record: Record<string, any>) => void;
  onRecordUpdate?: (id: string, updates: Record<string, any>) => Promise<void>;
  onRefresh?: () => void;
  onConfigChange?: (updates: Partial<T>) => void;
}

// ============================================================================
// Conditional Formatting
// ============================================================================

export type ConditionalOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'starts_with'
  | 'ends_with'
  | 'is_empty'
  | 'is_not_empty'
  | 'greater_than'
  | 'less_than'
  | 'greater_than_or_equal'
  | 'less_than_or_equal'
  | 'between'
  | 'is_today'
  | 'is_past'
  | 'is_future'
  | 'is_this_week'
  | 'is_this_month';

export type FormatStyleType =
  | 'background'
  | 'text_color'
  | 'bold'
  | 'italic'
  | 'strikethrough'
  | 'badge'
  | 'icon'
  | 'border'
  | 'highlight';

export interface FormatStyle {
  type: FormatStyleType;
  value?: string;
  backgroundColor?: string;
  textColor?: string;
  icon?: string;
  badgeText?: string;
  badgeColor?: string;
  borderColor?: string;
  borderWidth?: number;
}

export interface ConditionalFormatCondition {
  id: string;
  property: string;
  operator: ConditionalOperator;
  value?: unknown;
  value2?: unknown;
}

export interface ConditionalFormatRule {
  id: string;
  name: string;
  enabled: boolean;
  priority: number;
  scope: 'row' | 'cell' | 'column';
  targetProperty?: string;
  conditions: ConditionalFormatCondition[];
  conditionLogic: 'and' | 'or';
  styles: FormatStyle[];
  stopIfTrue?: boolean;
}

export interface ConditionalFormattingConfig {
  rules: ConditionalFormatRule[];
  enabled: boolean;
}
