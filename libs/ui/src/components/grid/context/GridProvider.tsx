/**
 * GridProvider - Combined context provider for HubbleDataGrid
 *
 * Provides access to:
 * - Grid state (TanStack Table instance)
 * - Grid data (SSRM or controlled)
 * - Grid AVA context
 * - Grid view system
 */

import React, { createContext, useContext, useMemo, useState } from 'react';
import type { Table } from '@tanstack/react-table';
import type {
  GridRowData,
  GridColumn,
  GridDensity,
  GridStateContextValue,
  GridDataContextValue,
  GridContext,
  AvaGridCommand,
  BlockCacheEntry,
} from '../types';

// =============================================================================
// STATE CONTEXT
// =============================================================================

const GridStateContext = createContext<GridStateContextValue<GridRowData> | null>(null);

export function useGridState<TData extends GridRowData>(): GridStateContextValue<TData> {
  const context = useContext(GridStateContext);
  if (!context) {
    throw new Error('useGridState must be used within GridProvider');
  }
  return context as unknown as GridStateContextValue<TData>;
}

// =============================================================================
// DATA CONTEXT
// =============================================================================

const GridDataContext = createContext<GridDataContextValue<GridRowData> | null>(null);

export function useGridData<TData extends GridRowData>(): GridDataContextValue<TData> {
  const context = useContext(GridDataContext);
  if (!context) {
    throw new Error('useGridData must be used within GridProvider');
  }
  return context as unknown as GridDataContextValue<TData>;
}

// =============================================================================
// COMMAND CONTEXT
// =============================================================================

interface GridCommandContextValue {
  processCommand: (command: AvaGridCommand) => Promise<void>;
  gridContext: GridContext;
}

const GridCommandContext = createContext<GridCommandContextValue | null>(null);

export function useGridCommand(): GridCommandContextValue {
  const context = useContext(GridCommandContext);
  if (!context) {
    throw new Error('useGridCommand must be used within GridProvider');
  }
  return context;
}

// =============================================================================
// PROVIDER PROPS
// =============================================================================

interface GridProviderProps<TData extends GridRowData> {
  children: React.ReactNode;
  table: Table<TData>;
  columns: GridColumn<TData>[];
  density?: GridDensity;
  data?: TData[];
  totalRowCount?: number;
  isLoading?: boolean;
  isError?: boolean;
  error?: Error | null;
  refetch?: () => void;
  loadedBlocks?: Map<number, BlockCacheEntry<TData>>;
  gridContext?: GridContext;
  processCommand?: (command: AvaGridCommand) => Promise<void>;
}

// =============================================================================
// PROVIDER COMPONENT
// =============================================================================

export function GridProvider<TData extends GridRowData>({
  children,
  table,
  columns,
  density = 'comfortable',
  data = [],
  totalRowCount = 0,
  isLoading = false,
  isError = false,
  error = null,
  refetch = () => {},
  loadedBlocks = new Map(),
  gridContext,
  processCommand = async () => {},
}: GridProviderProps<TData>) {
  const [focusedRowIndex, setFocusedRowIndex] = useState(-1);

  // State context value
  const stateValue = useMemo<GridStateContextValue<TData>>(
    () => ({
      table,
      columns,
      density,
      focusedRowIndex,
      setFocusedRowIndex,
    }),
    [table, columns, density, focusedRowIndex]
  );

  // Data context value
  const dataValue = useMemo<GridDataContextValue<TData>>(
    () => ({
      data,
      totalRowCount,
      isLoading,
      isError,
      error,
      refetch,
      loadedBlocks,
    }),
    [data, totalRowCount, isLoading, isError, error, refetch, loadedBlocks]
  );

  // Default grid context if not provided
  const defaultGridContext = useMemo<GridContext>(
    () => ({
      collection: '',
      columns: columns as unknown as GridColumn[],
      currentFilters: [],
      currentSorting: [],
      currentGrouping: [],
      selectedRowCount: Object.keys(table.getState().rowSelection).length,
      totalRowCount,
      visibleColumns: columns.filter((c) => c.visible !== false).map((c) => c.code),
      availableGroupings: columns.filter((c) => c.groupable !== false).map((c) => c.code),
    }),
    [columns, table, totalRowCount]
  );

  // Command context value
  const commandValue = useMemo<GridCommandContextValue>(
    () => ({
      processCommand,
      gridContext: gridContext ?? defaultGridContext,
    }),
    [processCommand, gridContext, defaultGridContext]
  );

  return (
    <GridStateContext.Provider value={stateValue as unknown as GridStateContextValue<GridRowData>}>
      <GridDataContext.Provider value={dataValue as unknown as GridDataContextValue<GridRowData>}>
        <GridCommandContext.Provider value={commandValue}>
          {children}
        </GridCommandContext.Provider>
      </GridDataContext.Provider>
    </GridStateContext.Provider>
  );
}

// =============================================================================
// GRID DENSITY HOOK
// =============================================================================

export function useGridDensity(): GridDensity {
  const { density } = useGridState();
  return density;
}

// =============================================================================
// GRID FOCUS HOOK
// =============================================================================

export function useGridFocus(): {
  focusedRowIndex: number;
  setFocusedRowIndex: (index: number) => void;
} {
  const { focusedRowIndex, setFocusedRowIndex } = useGridState();
  return { focusedRowIndex, setFocusedRowIndex };
}
