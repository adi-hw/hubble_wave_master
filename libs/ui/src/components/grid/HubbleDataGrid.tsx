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
import { AvaAssistBar } from './ava/AvaAssistBar';
import { GridHeader, SelectAllCheckbox } from './header/GridHeader';
import { GridBody } from './body/GridBody';
import { GridStatusBar } from './status/GridStatusBar';
import { LoadingOverlay, EmptyState, ErrorState } from './overlays';
import { getCellRenderer } from './cells';
import { useGridSSRM } from './hooks/useGridSSRM';
import { useGridKeyboard } from './hooks/useGridKeyboard';

import type {
  HubbleDataGridProps,
  GridColumn,
  GridDensity,
  GridRowData,
  AvaInsight,
  AvaGridCommand,
  GridContext,
} from './types';

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
  onChange: (event: unknown) => void;
}

function RowCheckbox({ checked, disabled, onChange }: RowCheckboxProps) {
  return (
    <div className="flex items-center justify-center w-12">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={onChange}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          'w-[var(--grid-checkbox-size)] h-[var(--grid-checkbox-size)]',
          'rounded border-2 border-[var(--grid-border)]',
          'bg-transparent cursor-pointer',
          'checked:bg-[var(--primary-500)] checked:border-[var(--primary-500)]',
          'focus:ring-2 focus:ring-[var(--primary-500)] focus:ring-offset-0',
          'disabled:opacity-50 disabled:cursor-not-allowed'
        )}
        aria-label="Select row"
      />
    </div>
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
  pageSize = 100,
  blockSize = 100,
  maxCacheBlocks = 100,
  ssrmFetcher,
  ssrmCountFetcher,

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
  columnResizeMode = 'onChange',

  // AVA Integration
  enableAva = true,
  avaContext: _avaContext,
  onAvaCommand,

  // Appearance
  density = 'comfortable',
  showToolbar = true,
  showStatusBar = true,
  showAvaBar = true,
  emptyMessage = 'No records found',
  emptyIcon,
  stripedRows: _stripedRows = true,
  hoverRows: _hoverRows = true,

  // Events
  onRowClick,
  onRowDoubleClick,
  onSelectionChange,
  onSortChange,
  onFilterChange,
  onGroupChange,
  onPageChange,
  onColumnResize: _onColumnResize,
  onColumnReorder,
  onRefresh,

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

  // ═══════════════════════════════════════════════════════════════════════════
  // STATE
  // ═══════════════════════════════════════════════════════════════════════════

  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [grouping, setGrouping] = useState<GroupingState>([]);
  const [expanded, setExpanded] = useState<ExpandedState>({});
  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>([]);
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({});
  const [columnPinning, setColumnPinning] = useState<ColumnPinningState>({});
  const [rowPinning, setRowPinning] = useState<RowPinningState>({ top: [], bottom: [] });
  const [globalFilter, setGlobalFilter] = useState('');
  const [focusedRowIndex, setFocusedRowIndex] = useState(-1);
  const [windowData, setWindowData] = useState<TData[]>([]);
  const [windowStart, setWindowStart] = useState(0);
  const [isFetchingBlocks, setIsFetchingBlocks] = useState(false);
  const [blockError, setBlockError] = useState<Error | null>(null);

  // AVA State
  const [insights, setInsights] = useState<AvaInsight[]>([]);

  // Accessibility - live region for screen reader announcements
  const [liveAnnouncement, setLiveAnnouncement] = useState('');

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
    fetchBlock,
    getRows,
    loadedBlocks,
    updateScrollPosition,
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

  // SSRM window hydration
  const loadWindow = useCallback(
    async (startRow: number, endRow: number) => {
      if (!ssrmEnabled) return;
      setIsFetchingBlocks(true);
      try {
        const rows = await getRows(startRow, endRow);
        setWindowData(rows);
        setWindowStart(startRow);
        setBlockError(null);
      } catch (err) {
        setBlockError(err as Error);
      } finally {
        setIsFetchingBlocks(false);
      }
    },
    [ssrmEnabled, getRows]
  );

  // Initial fetch for SSRM
  useEffect(() => {
    if (!ssrmEnabled) return;
    const initialEnd = Math.max(blockSize * 2, pageSize);
    loadWindow(0, initialEnd);
  }, [ssrmEnabled, blockSize, pageSize, loadWindow]);

  // Scroll velocity tracking for prefetch heuristics
  useEffect(() => {
    if (!ssrmEnabled) return;
    const scroller = scrollContainerRef.current;
    if (!scroller) return;

    const handleScroll = () => {
      updateScrollPosition(scroller.scrollTop);
    };

    scroller.addEventListener('scroll', handleScroll);
    return () => scroller.removeEventListener('scroll', handleScroll);
  }, [ssrmEnabled, updateScrollPosition]);

  // Combine hook-provided fetching/error with local window fetching
  const combinedError = (error as Error | null) ?? blockError ?? hookBlockError ?? null;
  const combinedIsError = isError || !!combinedError;
  const combinedIsLoading = isLoading || isFetchingBlocks || hookFetchingBlocks;

  const effectiveData = ssrmEnabled ? windowData : controlledData ?? ssrmData ?? [];
  const estimatedTotal = windowStart + windowData.length;
  const effectiveTotalRowCount =
    controlledData?.length ??
    (ssrmEnabled ? Math.max(totalRowCount, estimatedTotal) : totalRowCount ?? estimatedTotal);

  // ═══════════════════════════════════════════════════════════════════════════
  // COLUMNS CONFIGURATION
  // ═══════════════════════════════════════════════════════════════════════════

  const columns = useMemo(() => {
    const cols: ColumnDef<TData>[] = [];

    // Selection column
    if (enableRowSelection) {
      cols.push({
        id: 'select',
        header: ({ table }) => (
          <SelectAllCheckbox
            checked={table.getIsAllRowsSelected()}
            indeterminate={table.getIsSomeRowsSelected()}
            onChange={table.getToggleAllRowsSelectedHandler()}
          />
        ),
        cell: ({ row }) => (
          <RowCheckbox
            checked={row.getIsSelected()}
            disabled={!row.getCanSelect()}
            onChange={row.getToggleSelectedHandler()}
          />
        ),
        size: 48,
        enableSorting: false,
        enableResizing: false,
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
        cell: ({ getValue, row }: { getValue: () => unknown; row: { original: TData } }) => {
          if (col.renderCell) {
            return col.renderCell(getValue(), row.original);
          }
          const CellRenderer = getCellRenderer<TData>(col.type);
          return (
            <CellRenderer
              value={getValue()}
              column={col}
              row={row.original}
              rowIndex={0}
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
  }, [columnDefs, enableRowSelection, enableSorting, enableColumnResize, enableGrouping, enableColumnPinning]);

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
      // Only use pagination in SSRM mode; for controlled data, virtualization handles display
      ...(ssrmEnabled ? {
        pagination: {
          pageIndex: 0,
          pageSize,
        },
      } : {}),
    },
    onSortingChange: (updater) => {
      const newSorting = typeof updater === 'function' ? updater(sorting) : updater;
      setSorting(newSorting);
      onSortChange?.(newSorting);
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
      // Announce filter change for screen readers
      if (newFilters.length > 0) {
        setLiveAnnouncement(`${newFilters.length} filter${newFilters.length > 1 ? 's' : ''} applied`);
      } else {
        setLiveAnnouncement('Filters cleared');
      }
    },
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: (updater) => {
      const newSelection = typeof updater === 'function' ? updater(rowSelection) : updater;
      setRowSelection(newSelection);
      const selectedRows = Object.keys(newSelection)
        .map((id) => effectiveData.find((row) => row.id === id))
        .filter((row): row is TData => row !== undefined);
      onSelectionChange?.(selectedRows);
      // Announce selection change for screen readers
      const count = selectedRows.length;
      if (count === 0) {
        setLiveAnnouncement('Selection cleared');
      } else {
        setLiveAnnouncement(`${count} row${count > 1 ? 's' : ''} selected`);
      }
    },
    onGroupingChange: (updater) => {
      const newGrouping = typeof updater === 'function' ? updater(grouping) : updater;
      setGrouping(newGrouping);
      onGroupChange?.(newGrouping);
    },
    onExpandedChange: setExpanded,
    onColumnOrderChange: (updater) => {
      const newOrder = typeof updater === 'function' ? updater(columnOrder) : updater;
      setColumnOrder(newOrder);
      onColumnReorder?.(newOrder);
    },
    onColumnSizingChange: setColumnSizing,
    onColumnPinningChange: setColumnPinning,
    onRowPinningChange: setRowPinning,
    onGlobalFilterChange: setGlobalFilter,
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
    pageCount: ssrmEnabled ? Math.ceil(effectiveTotalRowCount / pageSize) : undefined,
    enableRowSelection,
    enableMultiRowSelection,
    enableRowPinning: true,
    keepPinnedRows: true,
    columnResizeMode,
    getRowId: (row) => row.id,
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // VIRTUALIZATION
  // ═══════════════════════════════════════════════════════════════════════════

  // When using controlled data (not SSRM), use full data length for virtualization
  // When using SSRM, use the server-reported total row count
  const virtualizerRowCount = ssrmEnabled ? effectiveTotalRowCount : effectiveData.length;

  const rowVirtualizer = useVirtualizer({
    count: virtualizerRowCount,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => getRowHeight(density),
    overscan: 10,
    onChange: (virtualizer) => {
      // Prefetch blocks for smooth scrolling
      if (ssrmEnabled && virtualizer.range) {
        const { startIndex, endIndex } = virtualizer.range;
        const startBlock = Math.floor(startIndex / blockSize);
        const endBlock = Math.floor(endIndex / blockSize);

        // Prefetch current blocks + 2 ahead and 1 behind
        for (let i = Math.max(0, startBlock - 1); i <= endBlock + 2; i++) {
          fetchBlock(i);
        }

        // Hydrate visible window if we have scrolled beyond current buffer
        const windowEnd = windowStart + windowData.length;
        const paddedStart = Math.max(0, startIndex - blockSize);
        const paddedEnd = endIndex + blockSize;
        const needsWindowUpdate = paddedStart < windowStart || paddedEnd > windowEnd;

        if (needsWindowUpdate) {
          loadWindow(paddedStart, paddedEnd);
        }
      }
    },
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalHeight = rowVirtualizer.getTotalSize();

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
      columns: columnDefs as GridColumn[],
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
    refetch();
    onRefresh?.();
  }, [refetch, onRefresh]);

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <GridProvider
      table={table}
      columns={columnDefs}
      density={density}
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
          'relative flex flex-col overflow-hidden',
          'bg-[var(--grid-bg)] border border-[var(--grid-border)]',
          'rounded-3xl shadow-[var(--grid-container-shadow)]',
          className
        )}
        style={{
          height,
          minHeight,
          maxHeight,
          ...style,
        }}
        data-density={density}
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
            enableGrouping={enableGrouping}
            enableExport={enableExport}
            viewId={viewId}
            onViewChange={onViewChange}
            onRefresh={handleRefresh}
          />
        )}

        {/* Main Grid Container */}
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-auto"
        >
          {/* Header */}
          <GridHeader
            table={table}
            enableColumnResize={enableColumnResize}
            enableColumnReorder={enableColumnReorder}
          />

          {/* Body */}
          {combinedIsLoading && !effectiveData.length ? (
            <LoadingOverlay />
          ) : combinedIsError ? (
            <ErrorState error={combinedError} onRetry={handleRefresh} />
          ) : effectiveData.length === 0 ? (
            <EmptyState message={emptyMessage} icon={emptyIcon} />
          ) : (
            <GridBody
              table={table}
              virtualRows={virtualRows}
              totalHeight={totalHeight}
              focusedRowIndex={focusedRowIndex}
              windowStart={windowStart}
              columns={columnDefs}
              onRowClick={onRowClick}
              onRowDoubleClick={onRowDoubleClick}
              density={density}
              loadedBlocks={loadedBlocks}
              blockSize={blockSize}
            />
          )}
        </div>

        {/* Status Bar */}
        {showStatusBar && (
          <GridStatusBar
            table={table}
            totalRowCount={effectiveTotalRowCount}
            isLoading={combinedIsLoading}
            pageSize={pageSize}
            onPageChange={onPageChange}
          />
        )}
      </div>
    </GridProvider>
  );
}

export default HubbleDataGrid;
