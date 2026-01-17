/**
 * Phase 2 view configuration types.
 */

export type ViewType =
  | 'list'
  | 'card'
  | 'calendar'
  | 'kanban'
  | 'timeline'
  | 'map'
  | 'gallery'
  | 'gantt'
  | 'pivot';

export type ViewVisibility = 'personal' | 'shared' | 'public';
export type ViewScope = 'system' | 'instance' | 'role' | 'group' | 'personal';

export type SortDirection = 'asc' | 'desc';

export interface ViewPermissions {
  read?: string[];
  write?: string[];
  admin?: string[];
}

export interface ColumnConfig {
  code: string;
  label: string;
  type?: string;
  width?: number;
  visible?: boolean;
  sortable?: boolean;
  filterable?: boolean;
  format?: string;
}

export type FilterOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'starts_with'
  | 'ends_with'
  | 'greater_than'
  | 'less_than'
  | 'greater_than_or_equal'
  | 'less_than_or_equal'
  | 'greater_than_or_equals'
  | 'less_than_or_equals'
  | 'between'
  | 'is_empty'
  | 'is_not_empty'
  | 'in_list'
  | 'not_in_list'
  | 'is_today'
  | 'is_past'
  | 'is_future'
  | 'is_this_week'
  | 'is_this_month';

export interface FilterCondition {
  field: string;
  operator: FilterOperator;
  value?: unknown;
  value2?: unknown;
}

export interface FilterGroup {
  operator: 'and' | 'or';
  conditions: FilterCondition[];
  groups?: FilterGroup[];
}

export interface SortConfig {
  field: string;
  direction: SortDirection;
  nulls?: 'first' | 'last';
}

export interface GroupingConfig {
  field: string;
  direction?: SortDirection;
}

export interface AggregationConfig {
  property: string;
  type: 'sum' | 'avg' | 'min' | 'max' | 'count' | 'countDistinct';
  label?: string;
  format?: string;
}

export interface TotalsConfig {
  position: 'top' | 'bottom' | 'both';
  properties: Record<string, AggregationConfig['type']>;
}

export interface FormatStyle {
  backgroundColor?: string;
  textColor?: string;
  fontWeight?: 'normal' | 'bold';
  fontStyle?: 'normal' | 'italic';
  icon?: string;
  iconColor?: string;
  borderColor?: string;
}

export interface ConditionalFormat {
  id: string;
  name: string;
  conditions: FilterGroup;
  style: FormatStyle;
  appliesTo: 'row' | 'cell' | string;
  targetProperty?: string;
}

export interface ViewConfiguration {
  id: string;
  name: string;
  type: ViewType;
  collectionId: string;
  isDefault: boolean;
  visibility: ViewVisibility;
  sharedWith?: string[];
  config: ViewTypeConfig;
  filters?: FilterGroup;
  sorting?: SortConfig[];
  grouping?: GroupingConfig;
  aggregations?: AggregationConfig[];
  conditionalFormatting?: ConditionalFormat[];
  permissions?: ViewPermissions;
}

export interface ListViewConfig {
  type: 'list';
  columns: ColumnConfig[];
  rowHeight?: 'compact' | 'default' | 'comfortable';
  showRowNumbers?: boolean;
  frozenColumns?: number;
  enableInlineEdit?: boolean;
  showTotals?: boolean;
  totalsConfig?: TotalsConfig;
}

export interface CardViewConfig {
  type: 'card';
  titleProperty: string;
  subtitleProperty?: string;
  imageProperty?: string;
  cardProperties?: string[];
  cardSize?: 'small' | 'medium' | 'large';
  columnsPerRow?: number;
}

export interface KanbanViewConfig {
  type: 'kanban';
  columnProperty: string;
  cardProperties: string[];
  cardColorProperty?: string;
  swimlaneProperty?: string;
  wipLimits?: Record<string, number>;
  showEmptyColumns?: boolean;
}

export interface CalendarViewConfig {
  type: 'calendar';
  dateProperty: string;
  endDateProperty?: string;
  titleProperty: string;
  colorProperty?: string;
  defaultView?: 'month' | 'week' | 'day';
  showWeekNumbers?: boolean;
  firstDayOfWeek?: 0 | 1 | 6;
}

export interface TimelineViewConfig {
  type: 'timeline';
  startDateProperty: string;
  endDateProperty: string;
  titleProperty: string;
  groupProperty?: string;
  colorProperty?: string;
  milestoneProperty?: string;
  showDependencies?: boolean;
  dependencyProperty?: string;
}

export interface MapViewConfig {
  type: 'map';
  locationProperty: string;
  titleProperty: string;
  popupProperties: string[];
  clusterMarkers?: boolean;
  mapStyle?: 'standard' | 'satellite' | 'hybrid';
  defaultCenter?: [number, number];
  defaultZoom?: number;
}

export interface GalleryViewConfig {
  type: 'gallery';
  titleProperty: string;
  subtitleProperty?: string;
  coverImageProperty?: string;
  cardProperties: string[];
  cardSize?: 'small' | 'medium' | 'large';
  columnsPerRow?: number;
  aspectRatio?: '1:1' | '4:3' | '16:9' | 'auto';
  showPropertyLabels?: boolean;
  enableLightbox?: boolean;
}

export interface GanttViewConfig {
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

export interface PivotValue {
  property: string;
  aggregation: 'sum' | 'count' | 'avg' | 'min' | 'max';
  format?: string;
}

export interface PivotViewConfig {
  type: 'pivot';
  rows: string[];
  columns: string[];
  values: PivotValue[];
  showTotals?: boolean;
  showGrandTotals?: boolean;
  expandByDefault?: boolean;
}

export type ViewTypeConfig =
  | ListViewConfig
  | CardViewConfig
  | CalendarViewConfig
  | KanbanViewConfig
  | TimelineViewConfig
  | MapViewConfig
  | GalleryViewConfig
  | GanttViewConfig
  | PivotViewConfig;
