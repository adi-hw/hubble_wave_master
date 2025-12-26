/**
 * GridBody - Virtualized body component for HubbleDataGrid
 *
 * Features:
 * - Row virtualization for 60fps scrolling with 20M+ records
 * - Row selection with visual feedback
 * - Row focus tracking for keyboard navigation
 * - Loading placeholder rows
 * - Group row support
 */

import React, { memo, useCallback } from 'react';
import { VirtualItem } from '@tanstack/react-virtual';
import { flexRender, Row, Table } from '@tanstack/react-table';
import { cn } from '../utils/cn';
import { getCellRenderer } from '../cells';
import type { GridRowData, GridColumn, GridDensity, BlockCacheEntry } from '../types';

// =============================================================================
// ROW CHECKBOX
// =============================================================================

interface RowCheckboxProps {
  checked: boolean;
  disabled?: boolean;
  onChange: (event: unknown) => void;
}

// RowCheckbox - kept for future use with row selection column
const _RowCheckbox = memo(function RowCheckbox({
  checked,
  disabled,
  onChange,
}: RowCheckboxProps) {
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
});
void _RowCheckbox;

// =============================================================================
// DATA ROW
// =============================================================================

interface DataRowProps<TData extends GridRowData> {
  row: Row<TData>;
  virtualRow: VirtualItem;
  isFocused: boolean;
  columns: GridColumn<TData>[];
  onRowClick?: (row: TData) => void;
  onRowDoubleClick?: (row: TData) => void;
  density: GridDensity;
}

const DataRow = memo(function DataRow<TData extends GridRowData>({
  row,
  virtualRow,
  isFocused,
  columns,
  onRowClick,
  onRowDoubleClick,
  density: _density,
}: DataRowProps<TData>) {
  void _density;
  const isSelected = row.getIsSelected();

  const handleClick = useCallback(() => {
    onRowClick?.(row.original);
  }, [row.original, onRowClick]);

  const handleDoubleClick = useCallback(() => {
    onRowDoubleClick?.(row.original);
  }, [row.original, onRowDoubleClick]);

  return (
    <div
      className={cn(
        'grid-row absolute left-0 w-full flex items-center',
        'border-b border-[var(--grid-cell-border)]',
        'transition-colors duration-100',
        isSelected && 'bg-[var(--grid-row-selected-bg)]',
        isFocused && 'bg-[var(--grid-row-focused-bg)] outline outline-2 outline-[var(--primary-500)] outline-offset-[-2px]',
        !isSelected && !isFocused && 'hover:bg-[var(--grid-row-hover-bg)]',
        virtualRow.index % 2 === 1 && !isSelected && !isFocused && 'bg-[var(--grid-row-alt-bg)]'
      )}
      style={{
        top: virtualRow.start,
        height: virtualRow.size,
      }}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      role="row"
      aria-rowindex={virtualRow.index + 1}
      aria-selected={isSelected}
      data-selected={isSelected}
      data-focused={isFocused}
      data-row-index={virtualRow.index}
    >
      {row.getVisibleCells().map((cell) => {
        const column = columns.find((c) => c.code === cell.column.id);
        const isPinned = cell.column.getIsPinned();

        return (
          <div
            key={cell.id}
            className={cn(
              'grid-cell flex items-center h-full overflow-hidden',
              'px-[var(--grid-cell-padding-x)]',
              'border-r border-[var(--grid-cell-border)] last:border-r-0',
              isPinned && 'sticky z-10 bg-inherit'
            )}
            style={{
              width: cell.column.getSize(),
              left: isPinned === 'left' ? cell.column.getStart('left') : undefined,
              right: isPinned === 'right' ? cell.column.getStart('right') : undefined,
            }}
            role="gridcell"
            aria-colindex={cell.column.getIndex() + 1}
          >
            {column?.renderCell ? (
              column.renderCell(cell.getValue(), row.original)
            ) : column ? (
              (() => {
                const CellRenderer = getCellRenderer<TData>(column.type);
                return (
                  <CellRenderer
                    value={cell.getValue()}
                    column={column}
                    row={row.original}
                    rowIndex={virtualRow.index}
                    isSelected={isSelected}
                    isFocused={isFocused}
                  />
                );
              })()
            ) : (
              flexRender(cell.column.columnDef.cell, cell.getContext())
            )}
          </div>
        );
      })}
    </div>
  );
}) as <TData extends GridRowData>(props: DataRowProps<TData>) => React.ReactElement;

// =============================================================================
// GROUP ROW
// =============================================================================

interface GroupRowProps<TData extends GridRowData> {
  row: Row<TData>;
  virtualRow: VirtualItem;
  depth: number;
}

const GroupRow = memo(function GroupRow<TData extends GridRowData>({
  row,
  virtualRow,
  depth,
}: GroupRowProps<TData>) {
  const isExpanded = row.getIsExpanded();

  return (
    <div
      className={cn(
        'grid-row-group absolute left-0 w-full flex items-center',
        'bg-[var(--grid-group-row-bg)]',
        'border-b border-[var(--grid-cell-border)]',
        'cursor-pointer hover:bg-[rgba(255,255,255,0.05)]',
        'transition-colors duration-100'
      )}
      style={{
        top: virtualRow.start,
        height: virtualRow.size,
        paddingLeft: `calc(${depth} * var(--grid-group-indent) + var(--grid-cell-padding-x))`,
      }}
      onClick={() => row.toggleExpanded()}
      role="row"
      aria-rowindex={virtualRow.index + 1}
      aria-expanded={isExpanded}
      aria-level={depth + 1}
    >
      {/* Expand/collapse icon */}
      <span
        className={cn(
          'flex-shrink-0 w-[var(--grid-expand-icon-size)] h-[var(--grid-expand-icon-size)]',
          'flex items-center justify-center mr-2',
          'transition-transform duration-200',
          isExpanded && 'rotate-90'
        )}
      >
        <svg className="w-3 h-3" viewBox="0 0 12 12" fill="currentColor">
          <path d="M4 2L10 6L4 10V2Z" />
        </svg>
      </span>

      {/* Group label */}
      <span className="font-semibold text-[var(--grid-cell-color)]">
        {row.groupingValue as string}
      </span>

      {/* Row count */}
      <span className="ml-2 text-[var(--grid-cell-muted-color)] text-sm">
        ({row.subRows.length})
      </span>
    </div>
  );
}) as <TData extends GridRowData>(props: GroupRowProps<TData>) => React.ReactElement;

// =============================================================================
// LOADING PLACEHOLDER
// =============================================================================

interface LoadingPlaceholderProps {
  virtualRow: VirtualItem;
  columnCount: number;
}

const LoadingPlaceholder = memo(function LoadingPlaceholder({
  virtualRow,
  columnCount,
}: LoadingPlaceholderProps) {
  return (
    <div
      className={cn(
        'grid-row-loading absolute left-0 w-full flex items-center',
        'border-b border-[var(--grid-cell-border)]'
      )}
      style={{
        top: virtualRow.start,
        height: virtualRow.size,
      }}
      role="row"
      aria-busy="true"
    >
      {Array.from({ length: columnCount }).map((_, i) => (
        <div
          key={i}
          className="flex-1 h-4 mx-4 rounded bg-[var(--glass-bg)] animate-pulse"
        />
      ))}
    </div>
  );
});

// =============================================================================
// GRID BODY COMPONENT
// =============================================================================

interface GridBodyProps<TData extends GridRowData> {
  table: Table<TData>;
  virtualRows: VirtualItem[];
  totalHeight: number;
  focusedRowIndex: number;
  windowStart?: number;
  columns: GridColumn<TData>[];
  onRowClick?: (row: TData) => void;
  onRowDoubleClick?: (row: TData) => void;
  density: GridDensity;
  loadedBlocks?: Map<number, BlockCacheEntry<TData>>;
  blockSize?: number;
}

export const GridBody = memo(function GridBody<TData extends GridRowData>({
  table,
  virtualRows,
  totalHeight,
  focusedRowIndex,
  windowStart = 0,
  columns,
  onRowClick,
  onRowDoubleClick,
  density,
  loadedBlocks,
  blockSize = 100,
}: GridBodyProps<TData>) {
  const { rows } = table.getRowModel();
  const visibleColumns = table.getVisibleLeafColumns();

  // Check if a row is loaded
  const isRowLoaded = useCallback(
    (rowIndex: number): boolean => {
      if (!loadedBlocks || loadedBlocks.size === 0) return true; // Not using SSRM
      const blockIndex = Math.floor(rowIndex / blockSize);
      return loadedBlocks.has(blockIndex);
    },
    [loadedBlocks, blockSize]
  );

  // Get row data for a virtual row
  const getRowData = useCallback(
    (virtualRow: VirtualItem): Row<TData> | null => {
      const relativeIndex = virtualRow.index - windowStart;
      if (relativeIndex < 0 || relativeIndex >= rows.length) return null;
      return rows[relativeIndex] ?? null;
    },
    [rows, windowStart]
  );

  return (
    <div
      className="relative w-full"
      style={{ height: totalHeight }}
      role="rowgroup"
    >
      {virtualRows.map((virtualRow) => {
        const row = getRowData(virtualRow);
        const isLoaded = isRowLoaded(virtualRow.index);

        // Show loading placeholder if row data not loaded
        if (!row || !isLoaded) {
          return (
            <LoadingPlaceholder
              key={virtualRow.key}
              virtualRow={virtualRow}
              columnCount={visibleColumns.length}
            />
          );
        }

        // Render group row
        if (row.getIsGrouped()) {
          return (
            <GroupRow
              key={virtualRow.key}
              row={row}
              virtualRow={virtualRow}
              depth={row.depth}
            />
          );
        }

        // Render data row
        return (
          <DataRow
            key={virtualRow.key}
            row={row}
            virtualRow={virtualRow}
            isFocused={virtualRow.index === focusedRowIndex}
            columns={columns}
            onRowClick={onRowClick}
            onRowDoubleClick={onRowDoubleClick}
            density={density}
          />
        );
      })}
    </div>
  );
}) as <TData extends GridRowData>(props: GridBodyProps<TData>) => React.ReactElement;
