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
  // State types (TanStack Table re-exports)
  SortingState,
  ColumnFiltersState,
  GroupingState,
  ColumnOrderState,
  ColumnPinningState,
  VisibilityState,
  ColumnSizingState,
  RowSelectionState,
  ExpandedState,
  // Grouped row types
  GroupedRow,
  GroupedQueryResult,
  GroupChildrenResult,
  GroupableRow,
  GroupExpansionState,
  // AVA types
  AvaInsight,
  AvaAction,
  AvaGridCommand,
  GridContext,
  AvaSuggestion,
  // Props types
  HubbleDataGridProps,
  // Inline editing types
  CellEditorProps,
  CellEditState,
  CellEditEvent,
  CellValidationResult,
  CellValidator,
  CellEditor,
  EditTrigger,
  OnCellEditComplete,
  OnCellEditStart,
  OnCellEditCancel,
} from './types';

// Utility functions
export { isGroupRow } from './types';

// Context and hooks
export { GridProvider, useGridState, useGridData, useGridCommand, useGridDensity, useGridFocus } from './context/GridProvider';
export { useGridSSRM } from './hooks/useGridSSRM';
export type { CountFetcher } from './hooks/useGridSSRM';
export { useGridGrouping } from './hooks/useGridGrouping';
export { useGridKeyboard } from './hooks/useGridKeyboard';
export { useGridExport } from './hooks/useGridExport';
export type { ExportFormat, ExportScope, ExportOptions, UseGridExportReturn } from './hooks/useGridExport';
export { useGridEditing } from './hooks/useGridEditing';
export type { UseGridEditingOptions, UseGridEditingReturn } from './hooks/useGridEditing';

// Sub-components (for advanced customization)
export { GridHeader, SelectAllCheckbox } from './header/GridHeader';
export { GridBody } from './body/GridBody';
export { GridToolbar } from './toolbar/GridToolbar';
export { InlineFilterPanel } from './toolbar/InlineFilterPanel';
export type { FilterState, FilterCondition, FilterGroup, LogicalOperator, FilterOperator } from './toolbar/InlineFilterPanel';
export { InlineColumnPanel } from './toolbar/InlineColumnPanel';
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

// Inline cell editors
export {
  getCellEditor,
  hasDefaultEditor,
  TextEditor,
  NumberEditor,
  CurrencyEditor,
  PercentEditor,
  DateEditor,
  DateTimeEditor,
  TimeEditor,
  DurationEditor,
  BooleanEditor,
  StatusEditor,
  PriorityEditor,
  TagsEditor,
  ProgressEditor,
  ReferenceEditor,
  UserEditor,
  EditorWrapper,
  // Popup editor for inline/multi-cell editing
  CellEditPopup,
  MultiCellEditPopup,
} from './editors';
export type { CellEditPopupProps } from './editors';

// Inline edit cell wrapper
export { InlineEditCell, isColumnTypeEditable, columnHasEditor } from './cells/InlineEditCell';

// SSRM Data Manager (for advanced use cases)
export { GridDataManager } from './ssrm/GridDataManager';

// Utility
export { cn } from './utils/cn';
