/**
 * HubbleDataGrid - Enterprise-grade data grid for HubbleWave
 *
 * Built on TanStack Table with:
 * - Full SSRM (Server-Side Row Model) for 20M+ records
 * - Row and column virtualization for 60fps scrolling
 * - Deep AVA integration for natural language commands
 * - 2070 Generation glassmorphic design system
 * - Full accessibility (WCAG 2.1 AA)
 *
 * @example
 * ```tsx
 * <HubbleDataGrid
 *   collection="work_orders"
 *   columns={columns}
 *   viewId={activeViewId}
 *   onRowClick={(row) => navigate(`/wo/${row.id}`)}
 *   enableAva={true}
 * />
 * ```
 */

import React, { useMemo, useCallback, useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getGroupedRowModel,
  getExpandedRowModel,
  getPaginationRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFacetedMinMaxValues,
  ColumnDef,
  SortingState,
  ColumnFiltersState,
  VisibilityState,
  RowSelectionState,
  GroupingState,
  ExpandedState,
  ColumnOrderState,
  ColumnSizingState,
  ColumnPinningState,
  RowPinningState,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';

import { cn } from './utils/cn';
import { GridProvider } from './context/GridProvider';
import { GridToolbar } from './toolbar/GridToolbar';
import { InlineFilterPanel, FilterState } from './toolbar/InlineFilterPanel';
import { InlineColumnPanel } from './toolbar/InlineColumnPanel';
import { AvaAssistBar } from './ava/AvaAssistBar';
import { GridHeader, SelectAllCheckbox } from './header/GridHeader';
import { GridBody } from './body/GridBody';
import { GridStatusBar } from './status/GridStatusBar';
import { LoadingOverlay, EmptyState, ErrorState } from './overlays';
import { getCellRenderer } from './cells';
import { CellEditPopup } from './editors/CellEditPopup';
import { useGridSSRM } from './hooks/useGridSSRM';
import { useGridGrouping } from './hooks/useGridGrouping';
import { useGridKeyboard } from './hooks/useGridKeyboard';
import { useGridEditing } from './hooks/useGridEditing';

import type {
  HubbleDataGridProps,
  GridColumn,
  GridDensity,
  GridRowData,
  AvaInsight,
  AvaGridCommand,
  GridContext,
} from './types';

// Grid styles + tokens for layout (required for header/row sizing)
import './grid-tokens.css';

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function getRowHeight(density: GridDensity): number {
  switch (density) {
    case 'compact':
      return 36;
    case 'comfortable':
      return 48;
    case 'spacious':
      return 60;
    default:
      return 48;
  }
}

// =============================================================================
// CHECKBOX COMPONENTS
// =============================================================================

interface RowCheckboxProps {
  checked: boolean;
  disabled?: boolean;
  onToggle: (e: React.MouseEvent) => void;
}

function RowCheckbox({ checked, disabled, onToggle }: RowCheckboxProps) {
  const handleClick = (e: React.MouseEvent<HTMLInputElement>) => {
    e.stopPropagation();
    // Pass the event to onToggle for Shift+Click range selection
    onToggle(e);
  };

  return (
    <input
      type="checkbox"
      checked={checked}
      disabled={disabled}
      onChange={() => {}} // Controlled component - state managed externally
      onClick={handleClick}
      aria-label="Select row"
    />
  );
}

// =============================================================================
// ROW ACTIONS MENU COMPONENT
// =============================================================================

interface RowAction<TData> {
  id: string;
  label: string;
  icon?: React.ReactNode;
  onClick: (row: TData) => void;
  disabled?: (row: TData) => boolean;
  hidden?: (row: TData) => boolean;
  variant?: 'default' | 'primary' | 'danger';
}

interface RowActionsMenuProps<TData> {
  row: TData;
  actions: RowAction<TData>[];
}

function RowActionsMenu<TData>({ row, actions }: RowActionsMenuProps<TData>) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [menuPosition, setMenuPosition] = React.useState<{ top: number; left: number } | null>(null);
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);

  // Filter out hidden actions
  const visibleActions = actions.filter((action) => !action.hidden?.(row));

  // Close menu when clicking outside
  React.useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const menuWidth = 160; // min-width of menu
      const menuHeight = visibleActions.length * 36 + 8; // Approximate: 36px per item + padding

      // Default position: to the right of the button, aligned to top of button
      let left = rect.right + 4;
      let top = rect.top;

      // If menu would go off right edge of screen, show it to the left of the button
      if (left + menuWidth > window.innerWidth - 16) {
        left = rect.left - menuWidth - 4;
      }

      // If menu would still go off left edge, position below the button instead
      if (left < 16) {
        left = Math.max(16, rect.left);
        top = rect.bottom + 4;
      }

      // Ensure menu doesn't go off bottom of screen - if so, align to bottom
      if (top + menuHeight > window.innerHeight - 16) {
        top = Math.max(16, window.innerHeight - menuHeight - 16);
      }

      // Ensure menu doesn't go off top of screen
      if (top < 16) {
        top = 16;
      }

      setMenuPosition({ top, left });
    }
    setIsOpen(!isOpen);
  };

  const handleActionClick = (action: RowAction<TData>, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!action.disabled?.(row)) {
      action.onClick(row);
      setIsOpen(false);
    }
  };

  if (visibleActions.length === 0) {
    return null;
  }

  return (
    <>
      <button
        ref={buttonRef}
        onClick={handleToggle}
        className="grid-actions-button"
        aria-label="Row actions"
        aria-haspopup="menu"
        aria-expanded={isOpen}
      >
        <svg
          className="w-4 h-4"
          viewBox="0 0 16 16"
          fill="currentColor"
        >
          <circle cx="8" cy="3" r="1.5" />
          <circle cx="8" cy="8" r="1.5" />
          <circle cx="8" cy="13" r="1.5" />
        </svg>
      </button>

      {isOpen && menuPosition && createPortal(
        <div
          ref={menuRef}
          className="grid-actions-menu"
          style={{
            position: 'fixed',
            top: menuPosition.top,
            left: menuPosition.left,
            zIndex: 9999,
          }}
          role="menu"
        >
          {visibleActions.map((action) => {
            const isDisabled = action.disabled?.(row) ?? false;
            return (
              <button
                key={action.id}
                onClick={(e) => handleActionClick(action, e)}
                disabled={isDisabled}
                className={cn(
                  'grid-actions-menu-item',
                  action.variant === 'danger' && 'grid-actions-menu-item-danger',
                  action.variant === 'primary' && 'grid-actions-menu-item-primary',
                  isDisabled && 'grid-actions-menu-item-disabled'
                )}
                role="menuitem"
              >
                {action.icon && <span className="grid-actions-menu-icon">{action.icon}</span>}
                <span>{action.label}</span>
              </button>
            );
          })}
        </div>,
        document.body
      )}
    </>
  );
}

// =============================================================================
// VIEW BUTTON COMPONENT
// =============================================================================

interface ViewButtonProps<TData> {
  row: TData;
  onClick: (row: TData) => void;
}

function ViewButton<TData>({ row, onClick }: ViewButtonProps<TData>) {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClick(row);
  };

  return (
    <button
      onClick={handleClick}
      className={cn(
        'flex items-center justify-center w-8 h-8 rounded',
        'text-[var(--grid-cell-muted-color)] hover:text-[var(--primary-400)]',
        'hover:bg-[var(--glass-bg-hover)] transition-colors duration-150',
        'focus:outline-none focus:ring-2 focus:ring-[var(--primary-400)]/30'
      )}
      aria-label="View record"
      title="View record"
    >
      <svg
        className="w-4 h-4"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    </button>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function HubbleDataGrid<TData extends GridRowData>({
  // Data Source
  collection,
  data: controlledData,
  columns: columnDefs,

  // View System
  viewId,
  defaultView: _defaultView,
  onViewChange,

  // Server-Side Options
  enableSSRM = true,
  pageSize = 25,
  blockSize = 100,
  maxCacheBlocks = 100,
  ssrmFetcher,
  ssrmCountFetcher,
  getAuthToken,

  // Initial State (for URL persistence)
  initialSorting,
  initialFilters,
  initialGrouping,
  initialGlobalFilter,
  initialColumnPinning,

  // Features
  enableSorting = true,
  enableFiltering = true,
  enableGrouping = true,
  enableRowSelection = true,
  enableMultiRowSelection = true,
  enableColumnResize = true,
  enableColumnReorder = true,
  enableColumnPinning = true,
  enableExport = true,
  enableSearch = true,
  enableQuickFilters: _enableQuickFilters = false,
  enableBulkActions: _enableBulkActions = true,
  columnResizeMode = 'onEnd',

  // AVA Integration
  enableAva = true,
  avaContext: _avaContext,
  onAvaCommand,

  // Appearance
  density = 'comfortable',
  showToolbar = true,
  showStatusBar = true,
  showAvaBar = true,
  toolbarTitle,
  onAdd,
  toolbarCustomActions,
  emptyMessage = 'No records found',
  emptyIcon,
  stripedRows: _stripedRows = true,
  hoverRows: _hoverRows = true,

  // Events
  onRowClick,
  onRowDoubleClick,
  onRowView,
  rowActions,
  onSelectionChange,
  onSortChange,
  onFilterChange,
  onGroupChange,
  onPageChange,
  onColumnResize: _onColumnResize,
  onColumnReorder,
  onColumnPinningChange,
  onColumnVisibilityChange,
  onRefresh,
  onReferenceClick,

  // Inline Editing
  enableEditing = false,
  editTrigger = 'doubleClick',
  onCellEditStart,
  onCellEditComplete,
  onCellEditCancel,
  cellValidator,

  // Accessibility
  ariaLabel,
  ariaDescribedBy,

  // Styling
  className,
  style,
  height = '100%',
  minHeight,
  maxHeight,
}: HubbleDataGridProps<TData>) {
  // Mark unused props (kept for API compatibility)
  void _defaultView;
  void _stripedRows;
  void _hoverRows;
  void _onColumnResize;
  void _enableQuickFilters;
  void _enableBulkActions;
  void _avaContext;

  // ═══════════════════════════════════════════════════════════════════════════
  // REFS
  // ═══════════════════════════════════════════════════════════════════════════

  const containerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const headerWrapperRef = useRef<HTMLDivElement>(null);

  // Track horizontal scroll for pinned column shadow effect and positioning
  const [isScrolledX, setIsScrolledX] = useState(false);
  const [scrollLeft, setScrollLeft] = useState(0);

  // Track anchor position for the cell edit popup
  const [editPopupAnchor, setEditPopupAnchor] = useState<DOMRect | null>(null);

  // ═══════════════════════════════════════════════════════════════════════════
  // STATE
  // ═══════════════════════════════════════════════════════════════════════════

  const initialColumnVisibility = useMemo<VisibilityState>(() => {
    return columnDefs.reduce<VisibilityState>((acc, col) => {
      if (col.visible === false) {
        acc[col.code] = false;
      }
      return acc;
    }, {});
  }, [columnDefs]);

  const [sorting, setSorting] = useState<SortingState>(() => initialSorting ?? []);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>(() => initialFilters ?? []);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => initialColumnVisibility);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [grouping, setGrouping] = useState<GroupingState>(() => initialGrouping ?? []);
  const [expanded, setExpanded] = useState<ExpandedState>({});
  // Initialize column order with all column IDs to enable reordering
  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>(() => {
    const ids: string[] = [];
    if (enableRowSelection) ids.push('select');
    if (onRowView) ids.push('_view');
    if (rowActions && rowActions.length > 0) ids.push('_actions');
    columnDefs.forEach((col) => ids.push(col.code));
    return ids;
  });
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({});
  // Initialize with select, _view, and _actions columns pinned to left if enabled, then merge with initial pinning from URL
  const [columnPinning, setColumnPinning] = useState<ColumnPinningState>(() => {
    const leftPinned: string[] = [];
    if (enableRowSelection) leftPinned.push('select');
    if (onRowView) leftPinned.push('_view');
    if (rowActions && rowActions.length > 0) leftPinned.push('_actions');

    // Merge with initialColumnPinning from URL params
    if (initialColumnPinning) {
      const urlLeftPinned = (initialColumnPinning.left ?? []).filter(
        col => col !== 'select' && col !== '_view' && col !== '_actions'
      );
      const urlRightPinned = initialColumnPinning.right ?? [];
      return {
        left: [...leftPinned, ...urlLeftPinned],
        right: urlRightPinned,
      };
    }

    return { left: leftPinned, right: [] };
  });
  const [rowPinning, setRowPinning] = useState<RowPinningState>({ top: [], bottom: [] });
  const [globalFilter, setGlobalFilter] = useState(() => initialGlobalFilter ?? '');
  const [currentPageSize, setCurrentPageSize] = useState(pageSize);
  const [currentDensity, setCurrentDensity] = useState<GridDensity>(density);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [focusedRowIndex, setFocusedRowIndex] = useState(-1);
  const [windowData, setWindowData] = useState<TData[]>([]);
  const [windowStart, setWindowStart] = useState(0);
  // Use a counter ref to track concurrent window fetches accurately
  const windowFetchingCountRef = useRef(0);
  const [isFetchingBlocks, setIsFetchingBlocks] = useState(false);
  const [blockError, setBlockError] = useState<Error | null>(null);

  // Cache for selected row data - maintains row data even when scrolled out of SSRM window
  const selectedRowsCacheRef = useRef<Map<string, TData>>(new Map());

  // Track last selected row index for Shift+Click range selection
  const lastSelectedRowIndexRef = useRef<number | null>(null);

  // AVA State
  const [insights, setInsights] = useState<AvaInsight[]>([]);

  // Inline panel state
  const [showInlineFilters, setShowInlineFilters] = useState(false);
  const [showInlineColumns, setShowInlineColumns] = useState(false);

  // Track scrollbar width for header alignment
  const [scrollbarWidth, setScrollbarWidth] = useState(0);

  // Accessibility - live region for screen reader announcements
  const [liveAnnouncement, setLiveAnnouncement] = useState('');

  // Keep column visibility in sync when column definitions change (respect default visibility)
  useEffect(() => {
    setColumnVisibility((prev) => {
      const next = { ...prev };
      for (const [id, visible] of Object.entries(initialColumnVisibility)) {
        if (next[id] === undefined) {
          next[id] = visible;
        }
      }
      return next;
    });
  }, [initialColumnVisibility]);

  // Keep column order in sync when column definitions change (add new columns)
  useEffect(() => {
    setColumnOrder((prev) => {
      const existingIds = new Set(prev);
      const newIds: string[] = [...prev];

      // Add select column if not present
      if (enableRowSelection && !existingIds.has('select')) {
        newIds.unshift('select');
        existingIds.add('select');
      }

      // Add _actions column if not present (after select)
      if (rowActions && rowActions.length > 0 && !existingIds.has('_actions')) {
        const insertIndex = existingIds.has('select') ? 1 : 0;
        newIds.splice(insertIndex, 0, '_actions');
        existingIds.add('_actions');
      }

      // Add any new columns from columnDefs
      columnDefs.forEach((col) => {
        if (!existingIds.has(col.code)) {
          newIds.push(col.code);
        }
      });

      return newIds;
    });
  }, [columnDefs, enableRowSelection, rowActions]);

  // ═══════════════════════════════════════════════════════════════════════════
  // DATA FETCHING (SSRM or Controlled)
  // ═══════════════════════════════════════════════════════════════════════════

  const ssrmEnabled = enableSSRM && !controlledData && !!collection;

  const {
    data: ssrmData,
    totalRowCount,
    isLoading,
    isError,
    error,
    isFetchingBlocks: hookFetchingBlocks,
    blockError: hookBlockError,
    refetch,
    fetchBlock: _fetchBlock,
    getRows,
    loadedBlocks,
    updateScrollPosition: _updateScrollPosition,
  } = useGridSSRM<TData>({
    collection: collection ?? '',
    enabled: ssrmEnabled,
    pageSize,
    blockSize,
    maxCacheBlocks,
    sorting,
    columnFilters,
    grouping,
    globalFilter,
    fetcher: ssrmFetcher,
    countFetcher: ssrmCountFetcher,
  });
  void ssrmData; // SSRM data is pulled on-demand via getRows

  // ═══════════════════════════════════════════════════════════════════════════
  // SERVER-SIDE GROUPING
  // ═══════════════════════════════════════════════════════════════════════════

  // Determine if we should use server-side grouping
  // Only for SSRM mode with an active grouping field
  const activeGroupByField = grouping.length > 0 ? grouping[0] : null;
  const useServerGrouping = ssrmEnabled && enableGrouping && !!activeGroupByField;

  const {
    isGrouped,
    flattenedRows: groupedRows,
    totalRowCount: groupedTotalCount,
    isLoading: groupedIsLoading,
    isError: groupedIsError,
    error: groupedError,
    expansionState,
    toggleGroup,
    loadMoreChildren,
    isGroupLoading,
    refetch: refetchGrouped,
    groups: _groups,
    totalRecords: _groupedTotalRecords,
  } = useGridGrouping<TData>({
    collection: collection ?? '',
    groupBy: activeGroupByField,
    enabled: useServerGrouping,
    sorting,
    columnFilters,
    globalFilter,
    childrenPageSize: pageSize,
    getAuthToken,
  });
  void _groups; // Available for future use (e.g., group aggregation display)
  void _groupedTotalRecords; // Available for future use (e.g., status bar total)
  void _fetchBlock; // Not used with pagination - data is fetched per page
  void _updateScrollPosition; // Not used with pagination

  // SSRM window hydration - stable reference for dependencies
  const loadWindowRef = useRef<((startRow: number, endRow: number) => Promise<void>) | undefined>(undefined);

  loadWindowRef.current = async (startRow: number, endRow: number) => {
    if (!ssrmEnabled) return;
    // Increment counter and set loading state
    windowFetchingCountRef.current += 1;
    setIsFetchingBlocks(true);
    try {
      const rows = await getRows(startRow, endRow);
      setWindowData(rows);
      setWindowStart(startRow);
      setBlockError(null);
    } catch (err) {
      setBlockError(err as Error);
    } finally {
      // Decrement counter and only clear loading state when all fetches complete
      windowFetchingCountRef.current = Math.max(0, windowFetchingCountRef.current - 1);
      if (windowFetchingCountRef.current === 0) {
        setIsFetchingBlocks(false);
      }
    }
  };

  // Track previous values to detect changes (for skip logic on initial mount)
  const prevSortingRef = useRef(sorting);
  const prevFiltersRef = useRef(columnFilters);
  const prevGlobalFilterRef = useRef(globalFilter);
  const prevGroupingRef = useRef(grouping);
  const isInitialMountRef = useRef(true);

  // Refetch when sorting/filtering changes (SSRM mode)
  useEffect(() => {
    if (!ssrmEnabled) return;

    // Skip on initial mount - pagination effect will handle the first load
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      return;
    }

    // Check if any of the config values actually changed
    const sortingChanged = JSON.stringify(sorting) !== JSON.stringify(prevSortingRef.current);
    const filtersChanged = JSON.stringify(columnFilters) !== JSON.stringify(prevFiltersRef.current);
    const globalFilterChanged = globalFilter !== prevGlobalFilterRef.current;
    const groupingChanged = JSON.stringify(grouping) !== JSON.stringify(prevGroupingRef.current);

    if (sortingChanged || filtersChanged || globalFilterChanged || groupingChanged) {
      // Don't clear windowData here - keep old data visible until new data arrives
      // This provides a smooth transition instead of a flash/reload effect
      setWindowStart(0);
      selectedRowsCacheRef.current.clear();

      // Reset to first page when filters change
      setCurrentPageIndex(0);

      // Note: The useGridSSRM hook's effect already called updateConfig which invalidates the cache.
      // We just need to fetch new data. The loadWindow function will replace windowData when ready.

      // Fetch new data with updated config - use page-based loading
      loadWindowRef.current?.(0, currentPageSize);

      // Update refs
      prevSortingRef.current = sorting;
      prevFiltersRef.current = columnFilters;
      prevGlobalFilterRef.current = globalFilter;
      prevGroupingRef.current = grouping;
    }
  }, [ssrmEnabled, currentPageSize, sorting, columnFilters, globalFilter, grouping]);

  // Track previous pagination to detect changes
  // Initialize with -1 to ensure first change is detected
  const prevPageIndexRef = useRef(-1);
  const prevPageSizeRef = useRef(-1);

  // Refetch when pagination changes (SSRM mode)
  useEffect(() => {
    if (!ssrmEnabled) return;

    const pageIndexChanged = currentPageIndex !== prevPageIndexRef.current;
    const pageSizeChanged = currentPageSize !== prevPageSizeRef.current;

    if (pageIndexChanged || pageSizeChanged) {
      // Calculate the row range for the new page
      const newPageStart = currentPageIndex * currentPageSize;
      const newPageEnd = newPageStart + currentPageSize;

      // Fetch the new page data
      loadWindowRef.current?.(newPageStart, newPageEnd);

      // Scroll to top when page changes (but not on initial load)
      if (scrollContainerRef.current && prevPageIndexRef.current !== -1) {
        scrollContainerRef.current.scrollTop = 0;
      }

      // Update refs
      prevPageIndexRef.current = currentPageIndex;
      prevPageSizeRef.current = currentPageSize;
    }
  }, [ssrmEnabled, currentPageIndex, currentPageSize]);

  // Combine hook-provided fetching/error with local window fetching and grouping
  const combinedError = isGrouped
    ? (groupedError ?? null)
    : ((error as Error | null) ?? blockError ?? hookBlockError ?? null);
  const combinedIsError = isGrouped
    ? groupedIsError
    : (isError || !!combinedError);
  const combinedIsLoading = isGrouped
    ? groupedIsLoading
    : (isLoading || isFetchingBlocks || hookFetchingBlocks);

  // In grouped mode, use the flattened grouped rows; otherwise use normal data flow
  const effectiveData = isGrouped
    ? (groupedRows as unknown as TData[])  // GroupableRow[] cast for table compatibility
    : (ssrmEnabled ? windowData : controlledData ?? ssrmData ?? []);
  const estimatedTotal = windowStart + windowData.length;
  const effectiveTotalRowCount = isGrouped
    ? groupedTotalCount
    : (controlledData?.length ??
      (ssrmEnabled ? Math.max(totalRowCount, estimatedTotal) : totalRowCount ?? estimatedTotal));

  // ═══════════════════════════════════════════════════════════════════════════
  // INLINE EDITING
  // ═══════════════════════════════════════════════════════════════════════════

  const {
    editState,
    startEditing,
    completeEditing,
    cancelEditing,
    navigateToCell,
    isColumnEditable,
  } = useGridEditing<TData>({
    columns: columnDefs,
    data: effectiveData,
    enableEditing,
    editTrigger,
    onCellEditStart,
    onCellEditComplete,
    onCellEditCancel,
    globalValidator: cellValidator,
  });

  // Handlers for cell editing in GridBody
  const handleCellEditComplete = useCallback(
    async (_rowId: string, _columnCode: string, newValue: unknown) => {
      const success = await completeEditing(newValue);
      if (success) {
        setEditPopupAnchor(null);
      }
      // Keep editing if validation failed
    },
    [completeEditing]
  );

  const handleCellEditStart = useCallback(
    (rowId: string, columnCode: string, cellElement?: HTMLElement) => {
      startEditing(rowId, columnCode);
      // Capture the cell's position for the popup
      if (cellElement) {
        setEditPopupAnchor(cellElement.getBoundingClientRect());
      }
    },
    [startEditing]
  );

  const handleCellEditCancel = useCallback(() => {
    cancelEditing();
    setEditPopupAnchor(null);
  }, [cancelEditing]);

  const handleCellNavigate = useCallback(
    (direction: 'next' | 'prev' | 'up' | 'down') => {
      navigateToCell(direction);
    },
    [navigateToCell]
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // COLUMNS CONFIGURATION
  // ═══════════════════════════════════════════════════════════════════════════

  const columns = useMemo(() => {
    const cols: ColumnDef<TData>[] = [];

    // Selection column
    if (enableRowSelection) {
      cols.push({
        id: 'select',
        header: ({ table }) => {
          const allRows = table.getRowModel().rows;
          const selectedCount = Object.keys(table.getState().rowSelection).length;
          const isAllSelected = allRows.length > 0 && selectedCount === allRows.length;
          const isSomeSelected = selectedCount > 0 && selectedCount < allRows.length;

          return (
            <SelectAllCheckbox
              checked={isAllSelected}
              indeterminate={isSomeSelected}
              onToggle={() => {
                if (isAllSelected) {
                  // Deselect all
                  table.resetRowSelection();
                  lastSelectedRowIndexRef.current = null;
                } else {
                  // Select all visible rows
                  const newSelection: RowSelectionState = {};
                  allRows.forEach((row) => {
                    newSelection[row.id] = true;
                  });
                  table.setRowSelection(newSelection);
                  lastSelectedRowIndexRef.current = null;
                }
              }}
            />
          );
        },
        cell: ({ row, table }) => {
          const isSelected = row.getIsSelected();
          const currentIndex = row.index;

          const handleToggle = (e: React.MouseEvent) => {
            const allRows = table.getRowModel().rows;

            // Shift+Click: Range selection
            if (e.shiftKey && lastSelectedRowIndexRef.current !== null && enableMultiRowSelection) {
              const lastIndex = lastSelectedRowIndexRef.current;
              const startIndex = Math.min(lastIndex, currentIndex);
              const endIndex = Math.max(lastIndex, currentIndex);

              // Get current selection state
              const currentSelection = { ...table.getState().rowSelection };

              // Select all rows in the range
              for (let i = startIndex; i <= endIndex; i++) {
                const rowInRange = allRows[i];
                if (rowInRange && rowInRange.getCanSelect()) {
                  currentSelection[rowInRange.id] = true;
                }
              }

              table.setRowSelection(currentSelection);
              // Keep the last selected index as the anchor
            } else if (e.ctrlKey || e.metaKey) {
              // Ctrl/Cmd+Click: Toggle individual row without affecting others
              row.toggleSelected(!isSelected);
              lastSelectedRowIndexRef.current = currentIndex;
            } else {
              // Normal click: Toggle the row
              row.toggleSelected(!isSelected);
              lastSelectedRowIndexRef.current = currentIndex;
            }
          };

          return (
            <RowCheckbox
              checked={isSelected}
              disabled={!row.getCanSelect()}
              onToggle={handleToggle}
            />
          );
        },
        size: 48,
        enableSorting: false,
        enableResizing: false,
        enablePinning: false, // Select column cannot be unpinned
      });
    }

    // View column - shows eye icon to view the record
    if (onRowView) {
      cols.push({
        id: '_view',
        header: () => null, // Empty header for view column
        cell: ({ row }: { row: { original: TData } }) => (
          <ViewButton row={row.original} onClick={onRowView} />
        ),
        size: 40,
        enableSorting: false,
        enableResizing: false,
        enablePinning: false, // View column cannot be unpinned
      });
    }

    // Actions column - shows 3-dots menu for row actions
    if (rowActions && rowActions.length > 0) {
      cols.push({
        id: '_actions',
        header: () => null, // Empty header for actions column
        cell: ({ row }: { row: { original: TData } }) => (
          <RowActionsMenu row={row.original} actions={rowActions} />
        ),
        size: 40,
        enableSorting: false,
        enableResizing: false,
        enablePinning: false, // Actions column cannot be unpinned
      });
    }

    // Map user columns to TanStack format
    cols.push(
      ...columnDefs.map((col) => ({
        id: col.code,
        accessorKey: col.code,
        header: col.label,
        size: col.width ?? 150,
        minSize: col.minWidth ?? 80,
        maxSize: col.maxWidth ?? 500,
        enableSorting: col.sortable !== false && enableSorting,
        enableResizing: col.resizable !== false && enableColumnResize,
        enableGrouping: col.groupable !== false && enableGrouping,
        enablePinning: col.pinnable !== false && enableColumnPinning,
        cell: ({ getValue, row }: { getValue: () => unknown; row: { original: TData; index: number } }) => {
          if (col.renderCell) {
            return col.renderCell(getValue(), row.original);
          }
          const CellRenderer = getCellRenderer<TData>(col.type);
          return (
            <CellRenderer
              value={getValue()}
              column={col}
              row={row.original}
              rowIndex={row.index}
              onReferenceClick={onReferenceClick}
            />
          );
        },
        meta: {
          type: col.type,
          format: col.format,
          options: col.options,
        },
      }))
    );

    return cols;
  }, [columnDefs, enableRowSelection, onRowView, rowActions, enableSorting, enableColumnResize, enableGrouping, enableColumnPinning, onReferenceClick]);

  // ═══════════════════════════════════════════════════════════════════════════
  // TABLE INSTANCE
  // ═══════════════════════════════════════════════════════════════════════════

  const table = useReactTable({
    data: effectiveData,
    columns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      grouping,
      expanded,
      columnOrder,
      columnSizing,
      columnPinning,
      rowPinning,
      globalFilter,
      // For SSRM mode: set pageIndex to 0 because effectiveData already contains only
      // the current page's rows. We manage pagination state externally.
      // For controlled data: don't use pagination, virtualization handles display.
      ...(ssrmEnabled ? {
        pagination: {
          pageIndex: 0, // Always 0 because effectiveData IS the current page's data
          pageSize: currentPageSize,
        },
      } : {}),
    },
    onSortingChange: (updater) => {
      const newSorting = typeof updater === 'function' ? updater(sorting) : updater;
      setSorting(newSorting);
      onSortChange?.(newSorting);
      // Note: Data refresh is handled by the useEffect that watches sorting state changes.
      // Announce sort change for screen readers
      if (newSorting.length > 0) {
        const sortCol = newSorting[0];
        const direction = sortCol.desc ? 'descending' : 'ascending';
        setLiveAnnouncement(`Sorted by ${sortCol.id} ${direction}`);
      } else {
        setLiveAnnouncement('Sorting cleared');
      }
    },
    onColumnFiltersChange: (updater) => {
      const newFilters = typeof updater === 'function' ? updater(columnFilters) : updater;
      setColumnFilters(newFilters);
      onFilterChange?.(newFilters);
      // Note: Data refresh is handled by the useEffect that watches filter state changes.
      // Announce filter change for screen readers
      if (newFilters.length > 0) {
        setLiveAnnouncement(`${newFilters.length} filter${newFilters.length > 1 ? 's' : ''} applied`);
      } else {
        setLiveAnnouncement('Filters cleared');
      }
    },
    onColumnVisibilityChange: (updater) => {
      const newVisibility = typeof updater === 'function' ? updater(columnVisibility) : updater;
      setColumnVisibility(newVisibility);
      onColumnVisibilityChange?.(newVisibility);
    },
    onRowSelectionChange: (updater) => {
      const newSelection = typeof updater === 'function' ? updater(rowSelection) : updater;
      // Update state immediately for responsive UI
      setRowSelection(newSelection);

      // Defer heavy work to next frame to avoid blocking the checkbox visual update
      requestAnimationFrame(() => {
        // Update the selected rows cache with any newly selected rows from current window
        const cache = selectedRowsCacheRef.current;
        const selectedIds = new Set(Object.keys(newSelection));

        // Add newly selected rows to cache from current window data
        for (const row of effectiveData) {
          if (selectedIds.has(row.id)) {
            cache.set(row.id, row);
          }
        }

        // Remove deselected rows from cache
        for (const cachedId of cache.keys()) {
          if (!selectedIds.has(cachedId)) {
            cache.delete(cachedId);
          }
        }

        // Build selected rows array from cache (includes rows scrolled out of view)
        const selectedRows = Object.keys(newSelection)
          .map((id) => cache.get(id))
          .filter((row): row is TData => row !== undefined);

        onSelectionChange?.(selectedRows);

        // Announce selection change for screen readers
        const count = selectedRows.length;
        if (count === 0) {
          setLiveAnnouncement('Selection cleared');
        } else {
          setLiveAnnouncement(`${count} row${count > 1 ? 's' : ''} selected`);
        }
      });
    },
    onGroupingChange: (updater) => {
      const newGrouping = typeof updater === 'function' ? updater(grouping) : updater;
      setGrouping(newGrouping);
      onGroupChange?.(newGrouping);
      // Note: Data refresh is handled by the useEffect that watches grouping state changes.
    },
    onExpandedChange: setExpanded,
    onColumnOrderChange: (updater) => {
      const newOrder = typeof updater === 'function' ? updater(columnOrder) : updater;
      setColumnOrder(newOrder);
      onColumnReorder?.(newOrder);
    },
    onColumnSizingChange: setColumnSizing,
    onColumnPinningChange: (updater) => {
      const newPinning = typeof updater === 'function' ? updater(columnPinning) : updater;
      setColumnPinning(newPinning);
      onColumnPinningChange?.(newPinning);
    },
    onRowPinningChange: setRowPinning,
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: (updater) => {
      const currentPagination = { pageIndex: currentPageIndex, pageSize: currentPageSize };
      const newPagination = typeof updater === 'function' ? updater(currentPagination) : updater;
      if (newPagination.pageIndex !== currentPageIndex) {
        setCurrentPageIndex(newPagination.pageIndex);
      }
      if (newPagination.pageSize !== currentPageSize) {
        setCurrentPageSize(newPagination.pageSize);
        // Reset to first page when page size changes
        setCurrentPageIndex(0);
      }
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getGroupedRowModel: enableGrouping ? getGroupedRowModel() : undefined,
    getExpandedRowModel: getExpandedRowModel(),
    // Only include pagination row model in SSRM mode
    getPaginationRowModel: ssrmEnabled ? getPaginationRowModel() : undefined,
    // Faceted models for filter dropdowns with counts
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    getFacetedMinMaxValues: getFacetedMinMaxValues(),
    manualPagination: ssrmEnabled,
    manualSorting: ssrmEnabled,
    manualFiltering: ssrmEnabled,
    manualGrouping: ssrmEnabled,
    // Prevent grouped columns from being moved to the left
    groupedColumnMode: false,
    pageCount: ssrmEnabled ? Math.ceil(effectiveTotalRowCount / currentPageSize) : undefined,
    rowCount: ssrmEnabled ? effectiveTotalRowCount : undefined,
    enableRowSelection,
    enableMultiRowSelection,
    enableRowPinning: true,
    keepPinnedRows: true,
    columnResizeMode,
    // Robust row ID extraction - handles different ID field names from various backends
    getRowId: (row, index) => {
      // Handle server-side group rows which use __groupId
      const groupId = (row as Record<string, unknown>).__groupId;
      if (groupId !== undefined && groupId !== null) {
        return String(groupId);
      }
      // Try common ID field names in priority order
      const id = row.id ?? row.sys_id ?? row._id ?? row.uuid ?? row.Id ?? row.ID;
      if (id !== undefined && id !== null) {
        return String(id);
      }
      // Fallback to index-based ID (not ideal but prevents crashes)
      console.warn('Row missing stable ID, using index. Selection/expansion may be unreliable.', row);
      return `__row_${index}`;
    },
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // VIRTUALIZATION
  // ═══════════════════════════════════════════════════════════════════════════

  // When using controlled data (not SSRM), use full data length for virtualization
  // When using SSRM with pagination, limit to current page size
  // Calculate how many rows are on the current page
  const pageStartRow = currentPageIndex * currentPageSize;
  const pageEndRow = Math.min(pageStartRow + currentPageSize, effectiveTotalRowCount);
  const currentPageRowCount = Math.max(0, pageEndRow - pageStartRow);

  const virtualizerRowCount = ssrmEnabled
    ? currentPageRowCount  // Only show current page's rows
    : effectiveData.length;

  // Track scroll container height for virtualizer
  const [scrollContainerHeight, setScrollContainerHeight] = useState(0);

  const rowVirtualizer = useVirtualizer({
    count: virtualizerRowCount,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => getRowHeight(currentDensity),
    overscan: 10,
    onChange: (_virtualizer) => {
      // With pagination enabled, we don't need scroll-based prefetching
      // Data for the current page is loaded when pagination changes
      // This handler is kept for potential future enhancements
      void _virtualizer;
    },
  });

  // Use ResizeObserver to detect when scroll container has a non-zero height
  // This is critical for virtualization to work correctly with flex layouts
  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const height = entry.contentRect.height;
        if (height > 0 && height !== scrollContainerHeight) {
          setScrollContainerHeight(height);
          // Re-measure virtualizer when container height changes
          rowVirtualizer.measure();
        }
      }
    });

    resizeObserver.observe(scrollContainer);

    // Also do an initial check
    const rect = scrollContainer.getBoundingClientRect();
    if (rect.height > 0) {
      setScrollContainerHeight(rect.height);
      rowVirtualizer.measure();
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [rowVirtualizer, scrollContainerHeight]);

  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalHeight = rowVirtualizer.getTotalSize();

  // Debug: if we have data but no virtual rows, the virtualizer hasn't measured correctly
  // Force a re-measure after a short delay
  useEffect(() => {
    if (virtualizerRowCount > 0 && virtualRows.length === 0 && scrollContainerHeight === 0) {
      // The container hasn't been measured yet - use requestAnimationFrame to wait for layout
      const rafId = requestAnimationFrame(() => {
        const scrollContainer = scrollContainerRef.current;
        if (scrollContainer) {
          const rect = scrollContainer.getBoundingClientRect();
          if (rect.height > 0) {
            setScrollContainerHeight(rect.height);
            rowVirtualizer.measure();
          }
        }
      });
      return () => cancelAnimationFrame(rafId);
    }
  }, [virtualizerRowCount, virtualRows.length, scrollContainerHeight, rowVirtualizer]);

  // ═══════════════════════════════════════════════════════════════════════════
  // HORIZONTAL SCROLL TRACKING (for pinned column shadows)
  // ═══════════════════════════════════════════════════════════════════════════

  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    const headerWrapper = headerWrapperRef.current;
    if (!scrollContainer) return;

    let rafId: number | null = null;
    let lastScrollLeft = scrollContainer.scrollLeft;

    const handleScroll = () => {
      const currentScrollLeft = scrollContainer.scrollLeft;

      // Immediately sync header scroll (no state, no re-render)
      if (headerWrapper) {
        headerWrapper.scrollLeft = currentScrollLeft;
      }

      // Debounce state updates to avoid excessive re-renders during scroll
      if (rafId === null) {
        rafId = requestAnimationFrame(() => {
          rafId = null;
          const scrolled = currentScrollLeft > 0;
          // Only update state if values changed
          if (scrolled !== (lastScrollLeft > 0)) {
            setIsScrolledX(scrolled);
          }
          if (currentScrollLeft !== lastScrollLeft) {
            setScrollLeft(currentScrollLeft);
            lastScrollLeft = currentScrollLeft;
          }
        });
      }
    };

    // Calculate and track vertical scrollbar width for header alignment
    const updateScrollbarWidth = () => {
      const newScrollbarWidth = scrollContainer.offsetWidth - scrollContainer.clientWidth;
      setScrollbarWidth(newScrollbarWidth);
    };

    // Use ResizeObserver to track container size changes which affect scrollbar visibility
    const resizeObserver = new ResizeObserver(() => {
      updateScrollbarWidth();
    });
    resizeObserver.observe(scrollContainer);

    scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // Check initial state
    updateScrollbarWidth(); // Calculate initial scrollbar width

    return () => {
      scrollContainer.removeEventListener('scroll', handleScroll);
      resizeObserver.disconnect();
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
    };
  }, []);

  // ═══════════════════════════════════════════════════════════════════════════
  // KEYBOARD NAVIGATION
  // ═══════════════════════════════════════════════════════════════════════════

  useGridKeyboard({
    containerRef: containerRef as React.RefObject<HTMLElement>,
    table,
    focusedRowIndex,
    setFocusedRowIndex,
    onRowClick,
    onRowDoubleClick,
    rowVirtualizer,
    totalRows: effectiveTotalRowCount,
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // AVA INTEGRATION
  // ═══════════════════════════════════════════════════════════════════════════

  const gridContext = useMemo<GridContext>(
    () => ({
      collection: collection ?? '',
      columns: columnDefs as unknown as GridColumn[],
      currentFilters: columnFilters,
      currentSorting: sorting,
      currentGrouping: grouping,
      selectedRowCount: Object.keys(rowSelection).length,
      totalRowCount: effectiveTotalRowCount,
      visibleColumns: columnDefs.filter((c) => c.visible !== false).map((c) => c.code),
      availableGroupings: columnDefs.filter((c) => c.groupable !== false).map((c) => c.code),
    }),
    [collection, columnDefs, columnFilters, sorting, grouping, rowSelection, effectiveTotalRowCount]
  );

  const processCommand = useCallback(
    async (command: AvaGridCommand) => {
      switch (command.type) {
        case 'filter':
          setColumnFilters(command.payload.filters as ColumnFiltersState);
          break;
        case 'sort':
          setSorting(command.payload.sorting as SortingState);
          break;
        case 'group':
          setGrouping(command.payload.grouping as GroupingState);
          break;
        case 'refresh':
          refetch();
          break;
      }
      onAvaCommand?.(command);
    },
    [refetch, onAvaCommand]
  );

  const dismissInsight = useCallback((insightId: string) => {
    setInsights((prev) => prev.filter((i) => i.id !== insightId));
  }, []);

  // ═══════════════════════════════════════════════════════════════════════════
  // HANDLERS
  // ═══════════════════════════════════════════════════════════════════════════

  const handleRefresh = useCallback(() => {
    if (isGrouped) {
      refetchGrouped();
    } else {
      refetch();
    }
    onRefresh?.();
  }, [isGrouped, refetch, refetchGrouped, onRefresh]);

  // Auto-size column based on content - tight fit algorithm
  const handleAutoSizeColumn = useCallback((columnId: string) => {
    // Get the column definition
    const columnDef = columnDefs.find((c) => c.code === columnId);
    if (!columnDef) return;

    // Calculate width based on header text length
    // Use tighter estimate: ~5.5px per char + 24px for sort icon and minimal padding
    const headerText = columnDef.label || columnId;
    const headerWidth = Math.ceil(headerText.length * 5.5) + 24;

    // Calculate width based on sample of data
    let maxContentWidth = 0;
    const sampleData = effectiveData.slice(0, 100); // Sample first 100 rows for better accuracy

    sampleData.forEach((row) => {
      const value = (row as Record<string, unknown>)[columnId];
      if (value !== null && value !== undefined) {
        const displayValue = String(value);
        // ~5.5px per character for body text + 8px padding (4px each side)
        const contentWidth = Math.ceil(displayValue.length * 5.5) + 8;
        maxContentWidth = Math.max(maxContentWidth, contentWidth);
      }
    });

    // Use the larger of header or content width
    // Ignore columnDef.minWidth for auto-size to get tight fit
    // Fixed minimum 36px to ensure column is always visible, maximum 300px to prevent huge columns
    const calculatedWidth = Math.max(headerWidth, maxContentWidth);
    const finalWidth = Math.min(Math.max(calculatedWidth, 36), 300);

    // Update column sizing
    setColumnSizing((prev) => ({
      ...prev,
      [columnId]: finalWidth,
    }));
  }, [columnDefs, effectiveData]);

  // Auto-size all columns based on content - tight fit algorithm
  const handleAutoSizeAllColumns = useCallback(() => {
    const newSizing: ColumnSizingState = {};
    const sampleData = effectiveData.slice(0, 100); // Sample first 100 rows for better accuracy

    columnDefs.forEach((columnDef) => {
      const columnId = columnDef.code;
      // Skip select and actions columns
      if (columnId === 'select' || columnId === '_actions') return;

      // Calculate width based on header text length
      // Use tighter estimate: ~5.5px per char + 24px for sort icon and minimal padding
      const headerText = columnDef.label || columnId;
      const headerWidth = Math.ceil(headerText.length * 5.5) + 24;

      // Calculate width based on sample of data
      let maxContentWidth = 0;
      sampleData.forEach((row) => {
        const value = (row as Record<string, unknown>)[columnId];
        if (value !== null && value !== undefined) {
          const displayValue = String(value);
          // ~5.5px per character for body text + 8px padding (4px each side)
          const contentWidth = Math.ceil(displayValue.length * 5.5) + 8;
          maxContentWidth = Math.max(maxContentWidth, contentWidth);
        }
      });

      // Use the larger of header or content width
      // Ignore columnDef.minWidth for auto-size to get tight fit
      // Fixed minimum 36px to ensure column is always visible, maximum 300px to prevent huge columns
      const calculatedWidth = Math.max(headerWidth, maxContentWidth);
      const finalWidth = Math.min(Math.max(calculatedWidth, 36), 300);
      newSizing[columnId] = finalWidth;
    });

    setColumnSizing((prev) => ({
      ...prev,
      ...newSizing,
    }));
  }, [columnDefs, effectiveData]);

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <GridProvider
      table={table}
      columns={columnDefs}
      density={currentDensity}
      data={effectiveData}
      totalRowCount={effectiveTotalRowCount}
      isLoading={combinedIsLoading}
      isError={combinedIsError}
      error={combinedError}
      refetch={handleRefresh}
      loadedBlocks={loadedBlocks}
      gridContext={gridContext}
      processCommand={processCommand}
    >
      <div
        ref={containerRef}
        className={cn(
          'hubble-data-grid',
          'rounded-xl',
          className
        )}
        style={{
          display: 'flex',
          flexDirection: 'column',
          // When using flex-based sizing (flex-1 or min-h-0 classes),
          // set flex properties directly and don't set fixed height
          ...(className?.includes('flex-1') || className?.includes('min-h-0')
            ? { flex: '1 1 0%', minHeight: 0 }
            : { height, minHeight }),
          maxHeight,
          overflow: 'hidden',
          ...style,
        }}
        data-density={currentDensity}
        data-scrolled-x={isScrolledX ? 'true' : undefined}
        role="grid"
        aria-label={ariaLabel ?? `${collection ?? 'Data'} grid`}
        aria-describedby={ariaDescribedBy}
        aria-rowcount={effectiveTotalRowCount}
        aria-busy={isLoading}
      >
        {/* Screen reader live announcements */}
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="sr-only"
        >
          {liveAnnouncement}
        </div>
        {/* AVA Assist Bar */}
        {showAvaBar && enableAva && insights.length > 0 && (
          <AvaAssistBar
            insights={insights}
            onAction={processCommand}
            onDismiss={dismissInsight}
          />
        )}

        {/* Toolbar */}
        {showToolbar && (
          <GridToolbar
            table={table}
            globalFilter={globalFilter}
            onGlobalFilterChange={setGlobalFilter}
            enableSearch={enableSearch}
            enableFiltering={enableFiltering}
            enableExport={enableExport}
            viewId={viewId}
            onViewChange={onViewChange}
            onRefresh={handleRefresh}
            title={toolbarTitle}
            onAdd={onAdd}
            customActions={toolbarCustomActions}
            showFilters={showInlineFilters}
            onShowFiltersChange={setShowInlineFilters}
            showColumns={showInlineColumns}
            onShowColumnsChange={setShowInlineColumns}
          />
        )}

        {/* Fixed Header - outside scroll container, synced with body horizontal scroll */}
        <div
          ref={headerWrapperRef}
          className="grid-header-wrapper"
          style={{
            flexShrink: 0,
            zIndex: 20,
            overflowX: 'hidden', // Hide horizontal scrollbar but allow programmatic scroll
            overflowY: 'hidden',
          }}
        >
          <GridHeader
            table={table}
            enableColumnResize={enableColumnResize}
            enableColumnReorder={enableColumnReorder}
            enableColumnPinning={enableColumnPinning}
            sorting={sorting}
            grouping={grouping}
            columnPinning={columnPinning}
            columnSizing={columnSizing}
            columnOrder={columnOrder}
            columnVisibility={columnVisibility}
            scrollContainerRef={scrollContainerRef}
            onAutoSizeColumn={handleAutoSizeColumn}
            onAutoSizeAllColumns={handleAutoSizeAllColumns}
            density={currentDensity}
            onDensityChange={setCurrentDensity}
            scrollbarWidth={scrollbarWidth}
          />
        </div>

        {/* Inline Panels - positioned absolutely over the scroll container */}
        <div className="relative" style={{ zIndex: 25 }}>
          {/* Inline Filter Panel - overlays the grid content */}
          {enableFiltering && (
            <InlineFilterPanel
              table={table}
              isOpen={showInlineFilters}
              onClose={() => setShowInlineFilters(false)}
              onApply={(filterState: FilterState) => {
                // Convert advanced filter to column filters
                // Extract simple conditions and apply them to the table
                const newFilters: ColumnFiltersState = [];
                filterState.rootGroup.conditions.forEach((item) => {
                  // Only process simple conditions, not nested groups
                  if (!('type' in item) && 'columnId' in item) {
                    const condition = item;
                    if (condition.columnId && condition.value !== undefined && condition.value !== '') {
                      newFilters.push({
                        id: condition.columnId,
                        value: condition.value,
                      });
                    }
                  }
                });
                table.setColumnFilters(newFilters);
                setShowInlineFilters(false);
              }}
            />
          )}

          {/* Inline Column Panel - overlays the grid content */}
          <InlineColumnPanel
            table={table}
            isOpen={showInlineColumns}
            onClose={() => setShowInlineColumns(false)}
            onColumnOrderChange={onColumnReorder}
          />
        </div>

        {/* Scroll container - flex item that scrolls */}
        <div
          ref={scrollContainerRef}
          className="grid-scroll-container"
          style={{
            flex: '1 1 0%',
            minHeight: 0,
            overflow: 'auto',
            position: 'relative',
          }}
        >
            {/* Error banner for block fetch errors when data is already displayed */}
            {combinedIsError && effectiveData.length > 0 && (
            <div className="flex items-center justify-between px-4 py-2 border-b border-danger-border bg-danger-subtle sticky top-0 z-10">
              <div className="flex items-center gap-2 text-danger-text">
                <svg
                  className="w-4 h-4"
                  viewBox="0 0 16 16"
                  fill="currentColor"
                >
                  <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 10.5a.75.75 0 110-1.5.75.75 0 010 1.5zm.75-3.25a.75.75 0 01-1.5 0V5a.75.75 0 011.5 0v3.25z" />
                </svg>
                <span className="text-sm">
                  {combinedError?.message ?? 'Failed to load some data'}
                </span>
              </div>
              <button
                onClick={handleRefresh}
                className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors bg-danger/10 text-danger-text hover:bg-danger/20"
              >
                <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M1 6C1 3.23858 3.23858 1 6 1C7.93254 1 9.60089 2.11658 10.3667 3.75" />
                  <path d="M11 6C11 8.76142 8.76142 11 6 11C4.06746 11 2.39911 9.88342 1.63333 8.25" />
                  <path d="M11 1V3.75H8.25" />
                  <path d="M1 11V8.25H3.75" />
                </svg>
                Retry
              </button>
            </div>
          )}

          {/* Body */}
          {combinedIsLoading && !effectiveData.length ? (
            <LoadingOverlay />
          ) : combinedIsError && !effectiveData.length ? (
            <ErrorState error={combinedError} onRetry={handleRefresh} />
          ) : effectiveData.length === 0 ? (
            <EmptyState message={emptyMessage} icon={emptyIcon} />
          ) : (
            <GridBody
              table={table}
              virtualRows={virtualRows}
              totalHeight={totalHeight}
              focusedRowIndex={focusedRowIndex}
              windowStart={isGrouped || ssrmEnabled ? 0 : windowStart}
              columns={columnDefs}
              onRowClick={onRowClick}
              onRowDoubleClick={onRowDoubleClick}
              onReferenceClick={onReferenceClick}
              density={currentDensity}
              loadedBlocks={loadedBlocks}
              blockSize={blockSize}
              rowSelection={rowSelection}
              columnSizing={columnSizing}
              columnOrder={columnOrder}
              columnVisibility={columnVisibility}
              columnPinning={columnPinning}
              scrollLeft={scrollLeft}
              // Server-side grouping props
              isGrouped={isGrouped}
              groupedRows={groupedRows}
              expansionState={expansionState}
              onToggleGroup={toggleGroup}
              onLoadMoreChildren={loadMoreChildren}
              isGroupLoading={isGroupLoading}
              groupByField={activeGroupByField}
              // Row actions
              rowActions={rowActions}
              // Inline editing props - pass null for editState since we use popup editing
              // This prevents the in-cell editor from rendering while still enabling edit triggers
              editState={null}
              isColumnEditable={isColumnEditable}
              onCellEditComplete={handleCellEditComplete}
              onCellEditCancel={handleCellEditCancel}
              onCellEditStart={handleCellEditStart}
              onCellNavigate={handleCellNavigate}
            />
          )}
        </div>

        {/* Status Bar */}
        {showStatusBar && (
          <GridStatusBar
            table={table}
            totalRowCount={effectiveTotalRowCount}
            isLoading={combinedIsLoading}
            pageSize={currentPageSize}
            pageIndex={currentPageIndex}
            onPageChange={(page) => {
              setCurrentPageIndex(page);
              onPageChange?.(page);
            }}
            onPageSizeChange={(size) => {
              setCurrentPageSize(size);
              setCurrentPageIndex(0); // Reset to first page
            }}
          />
        )}

        {/* Cell Edit Popup */}
        {enableEditing && editState && (
          <CellEditPopup
            column={columnDefs.find((col) => col.code === editState.columnCode) as GridColumn<TData>}
            selectedCount={1}
            currentValue={editState.currentValue}
            anchorRect={editPopupAnchor}
            isOpen={editState !== null && editPopupAnchor !== null}
            onApply={(newValue) => {
              handleCellEditComplete(editState.rowId, editState.columnCode, newValue);
            }}
            onCancel={handleCellEditCancel}
          />
        )}
      </div>
    </GridProvider>
  );
}

export default HubbleDataGrid;
