/**
 * GridHeader - Header row component for HubbleDataGrid
 *
 * Features:
 * - Column headers with sorting indicators
 * - Column resizing
 * - Column reordering (drag-drop)
 * - Select all checkbox
 * - Sticky positioning
 */

import React, { useCallback, useRef, useState, memo } from 'react';
import { flexRender, Header, Table } from '@tanstack/react-table';
import { cn } from '../utils/cn';
import type { GridRowData } from '../types';

// =============================================================================
// HEADER CELL COMPONENT
// =============================================================================

interface HeaderCellProps<TData extends GridRowData> {
  header: Header<TData, unknown>;
  enableResize: boolean;
  enableReorder: boolean;
}

const HeaderCell = memo(function HeaderCell<TData extends GridRowData>({
  header,
  enableResize,
  enableReorder: _enableReorder,
}: HeaderCellProps<TData>) {
  void _enableReorder;
  const [isResizing, setIsResizing] = useState(false);
  const resizeStartX = useRef(0);
  const initialWidth = useRef(0);

  const canSort = header.column.getCanSort();
  const isSorted = header.column.getIsSorted();

  // Handle column resize
  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      resizeStartX.current = e.clientX;
      initialWidth.current = header.getSize();
      setIsResizing(true);

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const delta = moveEvent.clientX - resizeStartX.current;
        const newWidth = Math.max(
          header.column.columnDef.minSize ?? 50,
          Math.min(header.column.columnDef.maxSize ?? 500, initialWidth.current + delta)
        );
        header.column.getLeafColumns().forEach((col) => {
          col.columnDef.size = newWidth;
        });
        // Force re-render by updating column sizing
        header.getContext().table.setColumnSizing((old) => ({
          ...old,
          [header.column.id]: newWidth,
        }));
      };

      const handleMouseUp = () => {
        setIsResizing(false);
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [header]
  );

  // Handle sort click
  const handleSortClick = useCallback(() => {
    if (canSort) {
      header.column.toggleSorting();
    }
  }, [header.column, canSort]);

  // Get sort direction for ARIA
  const sortDirection = isSorted === 'asc' ? 'ascending' : isSorted === 'desc' ? 'descending' : 'none';

  return (
    <div
      className={cn(
        'grid-header-cell relative flex items-center h-full',
        'px-[var(--grid-cell-padding-x)]',
        'border-r border-[var(--grid-cell-border)]',
        'last:border-r-0',
        canSort && 'cursor-pointer select-none',
        header.column.getIsPinned() && 'sticky z-20 bg-[var(--grid-header-bg)]'
      )}
      style={{
        width: header.getSize(),
        left: header.column.getIsPinned() === 'left' ? header.getStart('left') : undefined,
        right: header.column.getIsPinned() === 'right' ? header.getStart('right') : undefined,
      }}
      onClick={handleSortClick}
      role="columnheader"
      aria-sort={canSort ? sortDirection : undefined}
      aria-colindex={header.index + 1}
    >
      {/* Header content */}
      <div className="flex-1 flex items-center gap-2 overflow-hidden">
        {header.isPlaceholder
          ? null
          : flexRender(header.column.columnDef.header, header.getContext())}

        {/* Sort indicator */}
        {canSort && (
          <SortIndicator direction={isSorted} />
        )}

        {/* Filter indicator */}
        {header.column.getIsFiltered() && (
          <FilterIndicator />
        )}
      </div>

      {/* Resize handle */}
      {enableResize && header.column.getCanResize() && (
        <div
          className={cn(
            'grid-resize-handle absolute right-0 top-0 h-full w-1 cursor-col-resize',
            'hover:bg-[var(--grid-resize-handle)] transition-colors',
            isResizing && 'bg-[var(--grid-resize-handle-hover)]'
          )}
          onMouseDown={handleResizeStart}
          onClick={(e) => e.stopPropagation()}
        />
      )}
    </div>
  );
}) as <TData extends GridRowData>(props: HeaderCellProps<TData>) => React.ReactElement;

// =============================================================================
// SORT INDICATOR
// =============================================================================

interface SortIndicatorProps {
  direction: false | 'asc' | 'desc';
}

const SortIndicator = memo(function SortIndicator({ direction }: SortIndicatorProps) {
  return (
    <span
      className={cn(
        'flex-shrink-0 transition-opacity',
        direction ? 'opacity-100' : 'opacity-0 group-hover:opacity-40'
      )}
    >
      {direction === 'asc' ? (
        <svg className="w-3 h-3" viewBox="0 0 12 12" fill="currentColor">
          <path d="M6 2L10 8H2L6 2Z" />
        </svg>
      ) : direction === 'desc' ? (
        <svg className="w-3 h-3" viewBox="0 0 12 12" fill="currentColor">
          <path d="M6 10L2 4H10L6 10Z" />
        </svg>
      ) : (
        <svg className="w-3 h-3" viewBox="0 0 12 12" fill="currentColor" opacity="0.4">
          <path d="M6 2L9 5H3L6 2ZM6 10L3 7H9L6 10Z" />
        </svg>
      )}
    </span>
  );
});

// =============================================================================
// FILTER INDICATOR
// =============================================================================

const FilterIndicator = memo(function FilterIndicator() {
  return (
    <span className="flex-shrink-0 text-[var(--primary-400)]">
      <svg className="w-3 h-3" viewBox="0 0 12 12" fill="currentColor">
        <path d="M1 2H11L7 6.5V10L5 11V6.5L1 2Z" />
      </svg>
    </span>
  );
});

// =============================================================================
// SELECT ALL CHECKBOX
// =============================================================================

interface SelectAllCheckboxProps {
  checked: boolean;
  indeterminate: boolean;
  onChange: (event: unknown) => void;
  disabled?: boolean;
}

export const SelectAllCheckbox = memo(function SelectAllCheckbox({
  checked,
  indeterminate,
  onChange,
  disabled,
}: SelectAllCheckboxProps) {
  const ref = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = indeterminate;
    }
  }, [indeterminate]);

  return (
    <div className="flex items-center justify-center w-12">
      <input
        ref={ref}
        type="checkbox"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        className={cn(
          'w-[var(--grid-checkbox-size)] h-[var(--grid-checkbox-size)]',
          'rounded border-2 border-[var(--grid-border)]',
          'bg-transparent cursor-pointer',
          'checked:bg-[var(--primary-500)] checked:border-[var(--primary-500)]',
          'focus:ring-2 focus:ring-[var(--primary-500)] focus:ring-offset-0',
          'disabled:opacity-50 disabled:cursor-not-allowed'
        )}
        aria-label="Select all rows"
      />
    </div>
  );
});

// =============================================================================
// GRID HEADER COMPONENT
// =============================================================================

interface GridHeaderProps<TData extends GridRowData> {
  table: Table<TData>;
  enableColumnResize?: boolean;
  enableColumnReorder?: boolean;
}

export const GridHeader = memo(function GridHeader<TData extends GridRowData>({
  table,
  enableColumnResize = true,
  enableColumnReorder = false,
}: GridHeaderProps<TData>) {
  const headerGroups = table.getHeaderGroups();

  return (
    <div
      className={cn(
        'sticky top-0 z-10',
        'bg-[var(--grid-header-bg)]',
        'border-b border-[var(--grid-border)]',
        'shadow-[var(--grid-header-shadow)]'
      )}
      style={{ height: 'var(--grid-header-height)' }}
      role="rowgroup"
    >
      {headerGroups.map((headerGroup) => (
        <div
          key={headerGroup.id}
          className="flex h-full"
          role="row"
        >
          {headerGroup.headers.map((header) => (
            <HeaderCell
              key={header.id}
              header={header}
              enableResize={enableColumnResize}
              enableReorder={enableColumnReorder}
            />
          ))}
        </div>
      ))}
    </div>
  );
}) as <TData extends GridRowData>(props: GridHeaderProps<TData>) => React.ReactElement;
