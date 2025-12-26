/**
 * GridStatusBar - Status bar component for HubbleDataGrid
 *
 * Features:
 * - Row count display
 * - Selection count display
 * - Pagination controls
 * - Loading indicator
 */

import React, { memo, useCallback } from 'react';
import { Table } from '@tanstack/react-table';
import { cn } from '../utils/cn';
import type { GridRowData } from '../types';

// =============================================================================
// PAGINATION CONTROLS
// =============================================================================

interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalRows: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  isLoading?: boolean;
}

const PaginationControls = memo(function PaginationControls({
  currentPage,
  totalPages,
  pageSize,
  totalRows,
  onPageChange,
  onPageSizeChange,
  isLoading,
}: PaginationControlsProps) {
  const canPreviousPage = currentPage > 0;
  const canNextPage = currentPage < totalPages - 1;

  // Row range calculation available for future display
  void (currentPage * pageSize + 1); // startRow
  void Math.min((currentPage + 1) * pageSize, totalRows); // endRow

  return (
    <div className="flex items-center gap-4">
      {/* Page size selector */}
      {onPageSizeChange && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--grid-cell-muted-color)]">Show</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            disabled={isLoading}
            className={cn(
              'px-2 py-1 rounded text-xs',
              'bg-[var(--glass-bg)] border border-[var(--glass-border)]',
              'text-[var(--grid-cell-color)]',
              'focus:outline-none focus:ring-1 focus:ring-[var(--primary-500)]'
            )}
          >
            {[25, 50, 100, 200, 500].map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
          <span className="text-xs text-[var(--grid-cell-muted-color)]">rows</span>
        </div>
      )}

      {/* Page navigation */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(0)}
          disabled={!canPreviousPage || isLoading}
          className={cn(
            'p-1.5 rounded transition-colors',
            'text-[var(--grid-cell-muted-color)]',
            'hover:bg-[var(--glass-bg-hover)] hover:text-[var(--grid-cell-color)]',
            'disabled:opacity-30 disabled:cursor-not-allowed'
          )}
          aria-label="First page"
        >
          <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
            <path d="M11 3L6 8L11 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            <path d="M5 3V13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>

        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={!canPreviousPage || isLoading}
          className={cn(
            'p-1.5 rounded transition-colors',
            'text-[var(--grid-cell-muted-color)]',
            'hover:bg-[var(--glass-bg-hover)] hover:text-[var(--grid-cell-color)]',
            'disabled:opacity-30 disabled:cursor-not-allowed'
          )}
          aria-label="Previous page"
        >
          <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none">
            <path d="M10 3L5 8L10 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <span className="px-3 text-sm text-[var(--grid-cell-color)]">
          Page {currentPage + 1} of {totalPages || 1}
        </span>

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={!canNextPage || isLoading}
          className={cn(
            'p-1.5 rounded transition-colors',
            'text-[var(--grid-cell-muted-color)]',
            'hover:bg-[var(--glass-bg-hover)] hover:text-[var(--grid-cell-color)]',
            'disabled:opacity-30 disabled:cursor-not-allowed'
          )}
          aria-label="Next page"
        >
          <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none">
            <path d="M6 3L11 8L6 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <button
          onClick={() => onPageChange(totalPages - 1)}
          disabled={!canNextPage || isLoading}
          className={cn(
            'p-1.5 rounded transition-colors',
            'text-[var(--grid-cell-muted-color)]',
            'hover:bg-[var(--glass-bg-hover)] hover:text-[var(--grid-cell-color)]',
            'disabled:opacity-30 disabled:cursor-not-allowed'
          )}
          aria-label="Last page"
        >
          <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
            <path d="M5 3L10 8L5 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            <path d="M11 3V13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  );
});

// =============================================================================
// GRID STATUS BAR COMPONENT
// =============================================================================

interface GridStatusBarProps<TData extends GridRowData> {
  table: Table<TData>;
  totalRowCount: number;
  isLoading?: boolean;
  pageSize?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  className?: string;
}

export const GridStatusBar = memo(function GridStatusBar<TData extends GridRowData>({
  table,
  totalRowCount,
  isLoading = false,
  pageSize = 100,
  onPageChange,
  onPageSizeChange,
  className,
}: GridStatusBarProps<TData>) {
  const selectedRowCount = Object.keys(table.getState().rowSelection).length;
  const paginationState = table.getState().pagination;
  const isPaginated = paginationState && typeof paginationState.pageIndex === 'number';

  const currentPage = isPaginated ? paginationState.pageIndex : 0;
  const currentPageSize = isPaginated ? paginationState.pageSize : totalRowCount;
  const totalPages = isPaginated ? Math.ceil(totalRowCount / (currentPageSize || pageSize)) : 1;

  // For non-paginated (virtualized) mode, show all rows
  const startRow = isPaginated ? currentPage * (currentPageSize || pageSize) + 1 : 1;
  const endRow = isPaginated
    ? Math.min((currentPage + 1) * (currentPageSize || pageSize), totalRowCount)
    : totalRowCount;

  const handlePageChange = useCallback(
    (page: number) => {
      if (isPaginated) {
        table.setPageIndex(page);
        onPageChange?.(page);
      }
    },
    [table, onPageChange, isPaginated]
  );

  const handlePageSizeChange = useCallback(
    (size: number) => {
      if (isPaginated) {
        table.setPageSize(size);
        onPageSizeChange?.(size);
      }
    },
    [table, onPageSizeChange, isPaginated]
  );

  // Format large numbers
  const formatNumber = (num: number): string => {
    return new Intl.NumberFormat().format(num);
  };

  return (
    <div
      className={cn(
        'flex items-center justify-between px-4',
        'bg-[var(--grid-toolbar-bg)]',
        'border-t border-[var(--grid-border)]',
        'text-sm',
        className
      )}
      style={{ height: 'var(--grid-status-bar-height)' }}
    >
      {/* Left: Row count and selection */}
      <div className="flex items-center gap-4">
        {/* Loading indicator */}
        {isLoading && (
          <div className="flex items-center gap-2 text-[var(--grid-cell-muted-color)]">
            <div className="w-3 h-3 border-2 border-[var(--primary-400)] border-t-transparent rounded-full animate-spin" />
            <span>Loading...</span>
          </div>
        )}

        {/* Row count */}
        {!isLoading && (
          <span className="text-[var(--grid-cell-muted-color)]">
            {isPaginated ? (
              <>
                Showing {formatNumber(startRow)}-{formatNumber(endRow)} of{' '}
                <span className="text-[var(--grid-cell-color)] font-medium">
                  {formatNumber(totalRowCount)}
                </span>
              </>
            ) : (
              <>
                <span className="text-[var(--grid-cell-color)] font-medium">
                  {formatNumber(totalRowCount)}
                </span>{' '}
                total rows
              </>
            )}
          </span>
        )}

        {/* Selection count */}
        {selectedRowCount > 0 && (
          <span className="text-[var(--primary-400)]">
            {formatNumber(selectedRowCount)} selected
          </span>
        )}
      </div>

      {/* Right: Pagination (only show when paginated) */}
      {isPaginated && (
        <PaginationControls
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={currentPageSize || pageSize}
          totalRows={totalRowCount}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
          isLoading={isLoading}
        />
      )}
    </div>
  );
}) as <TData extends GridRowData>(props: GridStatusBarProps<TData>) => React.ReactElement;
