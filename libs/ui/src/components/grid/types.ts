/**
 * HubbleDataGrid - TypeScript Type Definitions
 *
 * Complete type definitions for the enterprise-grade data grid component.
 * Supports 20M+ records with SSRM, AVA integration, and full accessibility.
 */

import type {
  SortingState,
  ColumnFiltersState,
  VisibilityState,
  RowSelectionState,
  GroupingState,
  ExpandedState,
  ColumnOrderState,
  ColumnSizingState,
  ColumnPinningState,
  Table,
  Row,
} from '@tanstack/react-table';
import type { Virtualizer } from '@tanstack/react-virtual';
import type { ReactNode, CSSProperties, RefObject } from 'react';

// =============================================================================
// CORE TYPES
// =============================================================================

/**
 * Base row data interface - all grid data must have an ID
 */
export interface GridRowData {
  id: string;
  [key: string]: unknown;
}

// Forward declarations for types used in GridColumn
// Full definitions are in the INLINE EDITING TYPES section below
export interface CellEditorProps<TData extends GridRowData = GridRowData> {
  value: unknown;
  column: GridColumn<TData>;
  row: TData;
  rowIndex: number;
  onComplete: (newValue: unknown) => void;
  onCancel: () => void;
  onNavigate?: (direction: 'next' | 'prev' | 'up' | 'down') => void;
  autoFocus?: boolean;
  validationError?: string;
  isValidating?: boolean;
}

export interface CellValidationResult {
  isValid: boolean;
  errorMessage?: string;
}

export type CellValidator<TData extends GridRowData = GridRowData> = (
  value: unknown,
  row: TData,
  column: GridColumn<TData>
) => CellValidationResult | Promise<CellValidationResult>;

/**
 * Grid density modes
 */
export type GridDensity = 'compact' | 'comfortable' | 'spacious';

/**
 * Column data types for cell rendering
 */
export type GridColumnType =
  | 'text'
  | 'number'
  | 'currency'
  | 'percent'
  | 'date'
  | 'datetime'
  | 'time'
  | 'duration'
  | 'boolean'
  | 'status'
  | 'priority'
  | 'user'
  | 'reference'
  | 'tags'
  | 'progress'
  | 'image'
  | 'actions'
  | 'select'
  | 'rating'
  | 'email'
  | 'url'
  | 'phone'
  | 'custom';

/**
 * Filter operator types
 */
export type FilterOperator =
  | 'equals'
  | 'notEquals'
  | 'contains'
  | 'notContains'
  | 'startsWith'
  | 'endsWith'
  | 'greaterThan'
  | 'lessThan'
  | 'greaterThanOrEqual'
  | 'lessThanOrEqual'
  | 'between'
  | 'inList'
  | 'notInList'
  | 'isEmpty'
  | 'isNotEmpty';

/**
 * Status option configuration
 */
export interface StatusOption {
  value: string;
  label: string;
  color?: string;
  icon?: string;
}

/**
 * Reference configuration for lookup columns
 */
export interface ReferenceConfig {
  collection: string;
  displayProperty: string;
  searchProperties?: string[];
}

/**
 * Aggregation function types
 */
export type AggregationFunction = 'sum' | 'avg' | 'min' | 'max' | 'count' | 'unique';

/**
 * Row action definition for row context menus
 */
export interface RowAction<TData> {
  id: string;
  label: string;
  icon?: ReactNode;
  onClick: (row: TData) => void;
  disabled?: (row: TData) => boolean;
  hidden?: (row: TData) => boolean;
  variant?: 'default' | 'primary' | 'danger';
}

/**
 * Column definition for HubbleDataGrid
 */
export interface GridColumn<TData extends GridRowData = GridRowData> {
  /** Unique column identifier (maps to data property) */
  code: string;

  /** Display label for column header */
  label: string;

  /** Data type for rendering */
  type: GridColumnType;

  /** Column width in pixels */
  width?: number;

  /** Minimum column width */
  minWidth?: number;

  /** Maximum column width */
  maxWidth?: number;

  /** Enable sorting for this column */
  sortable?: boolean;

  /** Enable filtering for this column */
  filterable?: boolean;

  /** Enable grouping by this column */
  groupable?: boolean;

  /** Enable column resizing */
  resizable?: boolean;

  /** Enable column pinning */
  pinnable?: boolean;

  /** Column visibility */
  visible?: boolean;

  /** Display format (e.g., date format, number format) */
  format?: string;

  /** Options for choice columns (status, priority, etc.) */
  options?: StatusOption[];

  /** Reference configuration for lookup columns */
  reference?: ReferenceConfig;

  /** Custom cell renderer */
  renderCell?: (value: unknown, row: TData) => ReactNode;

  /** Custom header renderer */
  renderHeader?: () => ReactNode;

  /** Aggregation function for grouped data */
  aggregate?: AggregationFunction;

  /** Footer aggregate display */
  showFooter?: boolean;

  /** Column pinning position */
  pinned?: 'left' | 'right' | false;

  /** Cell alignment */
  align?: 'left' | 'center' | 'right';

  /** Whether this column is required for display */
  required?: boolean;

  /** Description/tooltip for the column */
  description?: string;

  /** Actions for actions column type */
  actions?: Array<{
    id: string;
    label: string;
    icon?: string;
    onClick: (row: TData) => void;
    disabled?: (row: TData) => boolean;
    hidden?: (row: TData) => boolean;
    variant?: 'default' | 'primary' | 'danger';
  }>;

  // ─────────────────────────────────────────────────────────────────────────────
  // INLINE EDITING OPTIONS
  // ─────────────────────────────────────────────────────────────────────────────

  /** Whether this column is editable (default: false) */
  editable?: boolean;

  /** Custom cell editor component for this column */
  editor?: React.ComponentType<CellEditorProps<TData>>;

  /** Custom render for edit mode (alternative to editor prop) */
  renderEditor?: (props: CellEditorProps<TData>) => ReactNode;

  /** Validation function for cell editing */
  validator?: CellValidator<TData>;

  /** Whether to skip this column during Tab navigation */
  skipOnTab?: boolean;

  /** Minimum characters before auto-complete triggers (for reference/status columns) */
  autoCompleteMinChars?: number;
}

// =============================================================================
// PROPS TYPES
// =============================================================================

/**
 * Main HubbleDataGrid component props
 */
export interface HubbleDataGridProps<TData extends GridRowData> {
  // ─────────────────────────────────────────────────────────────────────────────
  // DATA SOURCE
  // ─────────────────────────────────────────────────────────────────────────────

  /** Collection code for SSRM data fetching */
  collection?: string;

  /** Controlled data (disables SSRM) */
  data?: TData[];

  /** Column definitions */
  columns: GridColumn<TData>[];

  // ─────────────────────────────────────────────────────────────────────────────
  // VIEW SYSTEM
  // ─────────────────────────────────────────────────────────────────────────────

  /** Active view ID */
  viewId?: string;

  /** Default view configuration */
  defaultView?: GridViewConfig;

  /** Callback when view changes */
  onViewChange?: (viewId: string | null) => void;

  // ─────────────────────────────────────────────────────────────────────────────
  // SERVER-SIDE OPTIONS
  // ─────────────────────────────────────────────────────────────────────────────

  /** Enable Server-Side Row Model */
  enableSSRM?: boolean;

  /** Rows per page */
  pageSize?: number;

  /** Block size for SSRM caching */
  blockSize?: number;

  /** Maximum cached blocks */
  maxCacheBlocks?: number;

  /** Custom data fetcher for SSRM (uses default if not provided) */
  ssrmFetcher?: (request: SSRMRequest) => Promise<SSRMResponse<TData>>;

  /** Custom count fetcher for SSRM (uses default if not provided) */
  ssrmCountFetcher?: (params: {
    collection: string;
    filters?: ColumnFiltersState;
    grouping?: GroupingState;
    globalFilter?: string;
  }) => Promise<number>;

  /** Function to get auth token for API requests (required for authenticated endpoints) */
  getAuthToken?: () => string | null;

  // ─────────────────────────────────────────────────────────────────────────────
  // INITIAL STATE (for URL persistence)
  // ─────────────────────────────────────────────────────────────────────────────

  /** Initial sorting state (e.g., from URL params) */
  initialSorting?: SortingState;

  /** Initial filter state (e.g., from URL params) */
  initialFilters?: ColumnFiltersState;

  /** Initial grouping state (e.g., from URL params) */
  initialGrouping?: GroupingState;

  /** Initial global filter (e.g., from URL params) */
  initialGlobalFilter?: string;

  /** Initial column pinning state (e.g., from URL params) */
  initialColumnPinning?: ColumnPinningState;

  // ─────────────────────────────────────────────────────────────────────────────
  // FEATURES
  // ─────────────────────────────────────────────────────────────────────────────

  enableSorting?: boolean;
  enableFiltering?: boolean;
  enableGrouping?: boolean;
  enableRowSelection?: boolean;
  enableMultiRowSelection?: boolean;
  enableColumnResize?: boolean;
  enableColumnReorder?: boolean;
  enableColumnPinning?: boolean;
  enableExport?: boolean;
  enableSearch?: boolean;
  enableQuickFilters?: boolean;
  enableBulkActions?: boolean;

  /** Column resize mode - 'onChange' resizes while dragging, 'onEnd' resizes after releasing */
  columnResizeMode?: 'onChange' | 'onEnd';

  // ─────────────────────────────────────────────────────────────────────────────
  // AVA INTEGRATION
  // ─────────────────────────────────────────────────────────────────────────────

  /** Enable AVA AI assistant integration */
  enableAva?: boolean;

  /** Additional context for AVA */
  avaContext?: Record<string, unknown>;

  /** Callback when AVA executes a command */
  onAvaCommand?: (command: AvaGridCommand) => void;

  // ─────────────────────────────────────────────────────────────────────────────
  // APPEARANCE
  // ─────────────────────────────────────────────────────────────────────────────

  /** Row density mode */
  density?: GridDensity;

  /** Show toolbar */
  showToolbar?: boolean;

  /** Show status bar */
  showStatusBar?: boolean;

  /** Show AVA assist bar */
  showAvaBar?: boolean;

  /** Title displayed in toolbar (e.g., table/collection name) */
  toolbarTitle?: string;

  /** Callback for add button in toolbar - if provided, shows add button */
  onAdd?: () => void;

  /** Custom actions for toolbar */
  toolbarCustomActions?: ReactNode;

  /** Empty state message */
  emptyMessage?: string;

  /** Empty state icon */
  emptyIcon?: ReactNode;

  /** Enable alternating row colors */
  stripedRows?: boolean;

  /** Enable row hover effect */
  hoverRows?: boolean;

  // ─────────────────────────────────────────────────────────────────────────────
  // EVENTS
  // ─────────────────────────────────────────────────────────────────────────────

  /** Row click handler - DEPRECATED: Use onRowView for navigation */
  onRowClick?: (row: TData) => void;

  /** Row double-click handler */
  onRowDoubleClick?: (row: TData) => void;

  /** Row view handler - called when the view button (eye icon) is clicked */
  onRowView?: (row: TData) => void;

  /** Row actions configuration - if provided, shows actions column with 3-dots menu */
  rowActions?: Array<{
    id: string;
    label: string;
    icon?: ReactNode;
    onClick: (row: TData) => void;
    disabled?: (row: TData) => boolean;
    hidden?: (row: TData) => boolean;
    variant?: 'default' | 'primary' | 'danger';
  }>;

  /** Selection change handler */
  onSelectionChange?: (selectedRows: TData[]) => void;

  /** Sort change handler */
  onSortChange?: (sorting: SortingState) => void;

  /** Filter change handler */
  onFilterChange?: (filters: ColumnFiltersState) => void;

  /** Group change handler */
  onGroupChange?: (grouping: GroupingState) => void;

  /** Page change handler */
  onPageChange?: (page: number) => void;

  /** Column resize handler */
  onColumnResize?: (columnId: string, width: number) => void;

  /** Column reorder handler */
  onColumnReorder?: (columnOrder: ColumnOrderState) => void;

  /** Column pinning change handler */
  onColumnPinningChange?: (columnPinning: ColumnPinningState) => void;

  /** Column visibility change handler */
  onColumnVisibilityChange?: (columnVisibility: VisibilityState) => void;

  /** Data refresh handler */
  onRefresh?: () => void;

  /** Reference cell click handler - called when a reference field is clicked */
  onReferenceClick?: (referenceInfo: {
    /** The collection code of the referenced record */
    collection: string;
    /** The ID of the referenced record */
    recordId: string;
    /** The column code that was clicked */
    columnCode: string;
    /** The display value shown in the cell */
    displayValue: string;
    /** The full row data */
    row: TData;
  }) => void;

  // ─────────────────────────────────────────────────────────────────────────────
  // INLINE EDITING
  // ─────────────────────────────────────────────────────────────────────────────

  /** Enable inline cell editing (default: false) */
  enableEditing?: boolean;

  /** Edit trigger mode (default: 'doubleClick') */
  editTrigger?: EditTrigger;

  /** Callback when cell edit starts - return false to prevent editing */
  onCellEditStart?: OnCellEditStart<TData>;

  /** Callback when cell edit completes successfully */
  onCellEditComplete?: OnCellEditComplete<TData>;

  /** Callback when cell edit is cancelled */
  onCellEditCancel?: OnCellEditCancel<TData>;

  /** Global cell validator applied to all editable cells */
  cellValidator?: CellValidator<TData>;

  // ─────────────────────────────────────────────────────────────────────────────
  // ACCESSIBILITY
  // ─────────────────────────────────────────────────────────────────────────────

  /** ARIA label for the grid */
  ariaLabel?: string;

  /** ARIA described by ID */
  ariaDescribedBy?: string;

  // ─────────────────────────────────────────────────────────────────────────────
  // STYLING
  // ─────────────────────────────────────────────────────────────────────────────

  /** Additional CSS class */
  className?: string;

  /** Inline styles */
  style?: CSSProperties;

  /** Container height */
  height?: string | number;

  /** Container min height */
  minHeight?: string | number;

  /** Container max height */
  maxHeight?: string | number;
}

// =============================================================================
// VIEW TYPES
// =============================================================================

/**
 * Saved view configuration
 */
export interface GridViewConfig {
  id: string;
  name: string;
  description?: string;
  isDefault?: boolean;
  isSystem?: boolean;
  isShared?: boolean;
  config: {
    sorting?: SortingState;
    columnFilters?: ColumnFiltersState;
    columnVisibility?: VisibilityState;
    grouping?: GroupingState;
    columnOrder?: ColumnOrderState;
    columnSizing?: ColumnSizingState;
    columnPinning?: ColumnPinningState;
  };
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

// =============================================================================
// GROUPED ROW TYPES (Server-Side Grouping)
// =============================================================================

/**
 * A group row header returned from server-side grouping
 * Contains group metadata and aggregations, not actual data records
 */
export interface GroupedRow {
  /** Unique identifier for this group */
  __groupId: string;
  /** Flag indicating this is a group header, not a data row */
  __isGroup: true;
  /** The field being grouped by */
  __groupField: string;
  /** The value of the group field */
  __groupValue: unknown;
  /** Display label for the group */
  __groupLabel: string;
  /** Number of child records in this group */
  __childCount: number;
  /** Nesting depth (0 = top level) */
  __depth: number;
  /** Aggregated values for numeric columns */
  __aggregations?: Record<string, {
    sum?: number;
    avg?: number;
    min?: number;
    max?: number;
    count?: number;
  }>;
}

/**
 * Response from the server-side grouped query
 */
export interface GroupedQueryResult {
  /** Array of group headers */
  groups: GroupedRow[];
  /** Total number of distinct groups */
  totalGroups: number;
  /** Total records across all groups */
  totalRecords: number;
  /** Column definitions/property fields */
  fields: Array<{ code: string; label: string; type: string }>;
}

/**
 * Response when fetching children within a group
 * Matches backend GroupChildrenResult format
 */
export interface GroupChildrenResult<TData extends GridRowData = GridRowData> {
  /** Data records within the group */
  data: TData[];
  /** Pagination metadata */
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  /** Fields available */
  fields: Array<{ code: string; label: string; type: string }>;
}

/**
 * Combined row type for the grid when grouping is active
 * Can be either a group header or a data row
 */
export type GroupableRow<TData extends GridRowData = GridRowData> = GroupedRow | TData;

/**
 * Type guard to check if a row is a group header
 */
export function isGroupRow<TData extends GridRowData>(
  row: GroupableRow<TData>
): row is GroupedRow {
  return (row as GroupedRow).__isGroup === true;
}

/**
 * Expanded groups state - tracks which groups are expanded
 */
export interface GroupExpansionState {
  [groupId: string]: {
    isExpanded: boolean;
    /** Loaded children for this group */
    children: GridRowData[];
    /** Total count of children */
    totalChildren: number;
    /** Current page of loaded children */
    loadedPage: number;
    /** Whether more children are available */
    hasMore: boolean;
    /** Loading state for this group's children */
    isLoading: boolean;
  };
}

// =============================================================================
// SSRM TYPES
// =============================================================================

/**
 * SSRM request payload
 */
export interface SSRMRequest {
  collection: string;
  startRow: number;
  endRow: number;
  sorting?: SortingState;
  filters?: ColumnFiltersState;
  grouping?: GroupingState;
  globalFilter?: string;
  groupKeys?: string[];
}

/**
 * SSRM response payload
 */
export interface SSRMResponse<TData = GridRowData> {
  rows: TData[];
  lastRow: number;
  cacheId?: string;
  aggregations?: Record<string, unknown>;
  groupAggregations?: Record<string, Record<string, unknown>>;
}

/**
 * Block cache entry
 */
export interface BlockCacheEntry<TData = GridRowData> {
  blockIndex: number;
  rows: TData[];
  loadedAt: Date;
  version: string;
}

/**
 * Grid data manager configuration
 */
export interface GridDataManagerConfig {
  collection: string;
  blockSize: number;
  maxCacheBlocks: number;
  blockTTL?: number;
  sorting?: SortingState;
  filters?: ColumnFiltersState;
  grouping?: GroupingState;
  globalFilter?: string;
}

/**
 * Grid data manager statistics
 */
export interface GridDataManagerStats {
  cachedBlocks: number;
  maxBlocks: number;
  pendingRequests: number;
  queuedRequests: number;
  inFlightBlocks: number;
  cacheVersion: string;
  scrollVelocity: number;
  lastKnownTotalRows: number;
  isEndOfData: boolean;
}

// =============================================================================
// AVA TYPES
// =============================================================================

/**
 * AVA insight displayed in the assist bar
 */
export interface AvaInsight {
  id: string;
  type: 'info' | 'warning' | 'action' | 'suggestion';
  message: string;
  actions?: AvaAction[];
  priority: number;
  expiresAt?: Date;
}

/**
 * AVA action button
 */
export interface AvaAction {
  id: string;
  label: string;
  icon?: string;
  command: AvaGridCommand;
  variant?: 'primary' | 'secondary' | 'danger';
}

/**
 * AVA grid command
 */
export interface AvaGridCommand {
  type: AvaCommandType;
  payload: Record<string, unknown>;
}

/**
 * AVA command types
 */
export type AvaCommandType =
  | 'filter'
  | 'sort'
  | 'group'
  | 'select'
  | 'navigate'
  | 'export'
  | 'refresh'
  | 'bulkAction'
  | 'saveView'
  | 'loadView'
  | 'aggregate';

/**
 * Grid context for AVA
 */
export interface GridContext {
  collection: string;
  columns: GridColumn[];
  currentFilters: ColumnFiltersState;
  currentSorting: SortingState;
  currentGrouping: GroupingState;
  selectedRowCount: number;
  totalRowCount: number;
  visibleColumns: string[];
  availableGroupings: string[];
}

/**
 * AVA suggestion for search enhancement
 */
export interface AvaSuggestion {
  id: string;
  text: string;
  type: 'filter' | 'sort' | 'navigate' | 'action';
  confidence: number;
  command: AvaGridCommand;
}

// =============================================================================
// CELL RENDERER TYPES
// =============================================================================

/**
 * Cell renderer props
 */
export interface CellRendererProps<TData extends GridRowData = GridRowData> {
  value: unknown;
  column: GridColumn<TData>;
  row: TData;
  rowIndex: number;
  isSelected?: boolean;
  isFocused?: boolean;
  /** Handler for reference cell clicks - passed down from grid */
  onReferenceClick?: (referenceInfo: {
    collection: string;
    recordId: string;
    columnCode: string;
    displayValue: string;
    row: TData;
  }) => void;
}

// =============================================================================
// INLINE EDITING TYPES (Additional types - base types defined above)
// =============================================================================

/**
 * Edit mode trigger options
 */
export type EditTrigger = 'click' | 'doubleClick' | 'f2' | 'enter';

/**
 * Cell edit state - tracks which cell is being edited
 */
export interface CellEditState {
  /** Row ID being edited */
  rowId: string;
  /** Column code being edited */
  columnCode: string;
  /** Original value before editing */
  originalValue: unknown;
  /** Current value during editing */
  currentValue: unknown;
  /** Whether validation is in progress */
  isValidating?: boolean;
  /** Validation error message if any */
  validationError?: string;
}

/**
 * Cell edit event payload
 */
export interface CellEditEvent<TData extends GridRowData = GridRowData> {
  /** The row being edited */
  row: TData;
  /** The column being edited */
  column: GridColumn<TData>;
  /** The old value */
  oldValue: unknown;
  /** The new value */
  newValue: unknown;
  /** Row index in the current view */
  rowIndex: number;
}

/**
 * Cell edit complete callback type
 */
export type OnCellEditComplete<TData extends GridRowData = GridRowData> = (
  event: CellEditEvent<TData>
) => void | Promise<void>;

/**
 * Cell edit cancel callback type
 */
export type OnCellEditCancel<TData extends GridRowData = GridRowData> = (
  row: TData,
  column: GridColumn<TData>
) => void;

/**
 * Cell edit start callback type
 */
export type OnCellEditStart<TData extends GridRowData = GridRowData> = (
  row: TData,
  column: GridColumn<TData>,
  value: unknown
) => boolean | void;

/**
 * Cell editor component type
 */
export type CellEditor<TData extends GridRowData = GridRowData> =
  React.ComponentType<CellEditorProps<TData>>;

/**
 * Cell renderer component type
 */
export type CellRenderer<TData extends GridRowData = GridRowData> =
  React.ComponentType<CellRendererProps<TData>>;

// =============================================================================
// HOOK RETURN TYPES
// =============================================================================

/**
 * useGridSSRM return type
 */
export interface UseGridSSRMReturn<TData extends GridRowData> {
  data: TData[];
  totalRowCount: number;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  isFetchingBlocks: boolean;
  blockError: Error | null;
  refetch: () => void;
  getRows: (startRow: number, endRow: number) => Promise<TData[]>;
  fetchBlock: (blockIndex: number) => void;
  updateScrollPosition: (position: number) => void;
  loadedBlocks: Map<number, BlockCacheEntry<TData>>;
  stats?: GridDataManagerStats;
}

/**
 * useGridAva return type
 */
export interface UseGridAvaReturn {
  insights: AvaInsight[];
  suggestions: AvaSuggestion[];
  processCommand: (command: AvaGridCommand) => Promise<void>;
  processNaturalLanguage: (input: string) => Promise<AvaGridCommand | null>;
  dismissInsight: (insightId: string) => void;
  gridContext: GridContext;
  isAnalyzing: boolean;
}

/**
 * useGridKeyboard options
 */
export interface UseGridKeyboardOptions<TData> {
  containerRef: RefObject<HTMLElement>;
  table: Table<TData>;
  focusedRowIndex: number;
  setFocusedRowIndex: (index: number) => void;
  onRowClick?: (row: TData) => void;
  onRowDoubleClick?: (row: TData) => void;
  rowVirtualizer: Virtualizer<HTMLDivElement, Element>;
}

// =============================================================================
// CONTEXT TYPES
// =============================================================================

/**
 * Grid state context value
 */
export interface GridStateContextValue<TData extends GridRowData> {
  table: Table<TData>;
  columns: GridColumn<TData>[];
  density: GridDensity;
  focusedRowIndex: number;
  setFocusedRowIndex: (index: number) => void;
}

/**
 * Grid data context value
 */
export interface GridDataContextValue<TData extends GridRowData> {
  data: TData[];
  totalRowCount: number;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
  loadedBlocks: Map<number, BlockCacheEntry<TData>>;
}

/**
 * Grid AVA context value
 */
export interface GridAvaContextValue {
  gridContext: GridContext;
  insights: AvaInsight[];
  suggestions: AvaSuggestion[];
  processNaturalLanguage: (input: string) => Promise<AvaGridCommand | null>;
  executeCommand: (command: AvaGridCommand) => Promise<void>;
  dismissInsight: (insightId: string) => void;
  requestInsights: () => void;
  isAnalyzing: boolean;
}

/**
 * Grid view context value
 */
export interface GridViewContextValue {
  activeView: GridViewConfig | null;
  availableViews: GridViewConfig[];
  isModified: boolean;
  loadView: (viewId: string) => void;
  saveAsNewView: (name: string, options?: SaveViewOptions) => Promise<GridViewConfig>;
  updateCurrentView: () => Promise<void>;
  resetToDefault: () => void;
  deleteView: (viewId: string) => Promise<void>;
  canEditView: (view: GridViewConfig) => boolean;
  isLoading: boolean;
}

/**
 * Save view options
 */
export interface SaveViewOptions {
  description?: string;
  isShared?: boolean;
  isDefault?: boolean;
}

// =============================================================================
// EXPORT TYPES
// =============================================================================

/**
 * Export format options
 */
export type ExportFormat = 'csv' | 'xlsx' | 'pdf' | 'json';

/**
 * Export options
 */
export interface ExportOptions {
  format: ExportFormat;
  filename?: string;
  selectedOnly?: boolean;
  visibleColumnsOnly?: boolean;
  includeHeaders?: boolean;
}

// =============================================================================
// TOOLBAR TYPES
// =============================================================================

/**
 * Quick filter configuration
 */
export interface QuickFilter {
  id: string;
  label: string;
  column: string;
  operator: FilterOperator;
  value: unknown;
}

/**
 * Bulk action configuration
 */
export interface BulkAction<TData extends GridRowData = GridRowData> {
  id: string;
  label: string;
  icon?: ReactNode;
  variant?: 'primary' | 'secondary' | 'danger';
  requiresConfirmation?: boolean;
  confirmationMessage?: string;
  onAction: (selectedRows: TData[]) => void | Promise<void>;
}

// =============================================================================
// RE-EXPORTS FROM TANSTACK TABLE
// =============================================================================

export type {
  SortingState,
  ColumnFiltersState,
  VisibilityState,
  RowSelectionState,
  GroupingState,
  ExpandedState,
  ColumnOrderState,
  ColumnSizingState,
  ColumnPinningState,
  Table,
  Row,
};
