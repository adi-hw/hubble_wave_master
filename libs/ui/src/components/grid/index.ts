/**
 * HubbleDataGrid - Enterprise-grade data grid for HubbleWave
 *
 * @module @hubblewave/ui/grid
 *
 * Usage:
 * ```tsx
 * import { HubbleDataGrid } from '@hubblewave/ui';
 *
 * <HubbleDataGrid
 *   collection="work_orders"
 *   columns={columns}
 *   onRowClick={(row) => navigate(`/wo/${row.id}`)}
 *   enableAva={true}
 * />
 * ```
 */

// Main component
export { HubbleDataGrid, default } from './HubbleDataGrid';

// Types
export type {
  // Core types
  GridRowData,
  GridColumn,
  GridColumnType,
  GridDensity,
  // SSRM types
  SSRMRequest,
  SSRMResponse,
  BlockCacheEntry,
  // State types
  SortingState,
  ColumnFiltersState,
  GroupingState,
  // AVA types
  AvaInsight,
  AvaAction,
  AvaGridCommand,
  GridContext,
  AvaSuggestion,
  // Props types
  HubbleDataGridProps,
} from './types';

// Context and hooks
export { GridProvider, useGridState, useGridData, useGridCommand, useGridDensity, useGridFocus } from './context/GridProvider';
export { useGridSSRM } from './hooks/useGridSSRM';
export type { CountFetcher } from './hooks/useGridSSRM';
export { useGridKeyboard } from './hooks/useGridKeyboard';
export { useGridExport } from './hooks/useGridExport';
export type { ExportFormat, ExportScope, ExportOptions, UseGridExportReturn } from './hooks/useGridExport';

// Sub-components (for advanced customization)
export { GridHeader, SelectAllCheckbox } from './header/GridHeader';
export { GridBody } from './body/GridBody';
export { GridToolbar } from './toolbar/GridToolbar';
export { GridStatusBar } from './status/GridStatusBar';
export { AvaAssistBar } from './ava/AvaAssistBar';
export { LoadingOverlay, SkeletonRows, EmptyState, ErrorState } from './overlays';

// Cell renderers
export {
  getCellRenderer,
  TextCell,
  NumberCell,
  CurrencyCell,
  PercentCell,
  DateCell,
  DateTimeCell,
  TimeCell,
  DurationCell,
  BooleanCell,
  StatusCell,
  PriorityCell,
  ProgressCell,
  UserCell,
  ReferenceCell,
  TagsCell,
  ImageCell,
  ActionsCell,
} from './cells';

// SSRM Data Manager (for advanced use cases)
export { GridDataManager } from './ssrm/GridDataManager';

// Utility
export { cn } from './utils/cn';
