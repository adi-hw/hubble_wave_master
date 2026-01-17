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
          <span className="text-xs text-muted-foreground">Show</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            disabled={isLoading}
            className="h-7 px-2 text-xs rounded border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
          >
            {[25, 50, 100, 200, 500].map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
          <span className="text-xs text-muted-foreground">rows</span>
        </div>
      )}

      {/* Page navigation */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(0)}
          disabled={!canPreviousPage || isLoading}
          className="btn-ghost btn-icon btn-xs disabled:opacity-30 disabled:cursor-not-allowed"
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
          className="btn-ghost btn-icon btn-xs disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="Previous page"
        >
          <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none">
            <path d="M10 3L5 8L10 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <span className="px-3 text-sm text-foreground">
          Page {currentPage + 1} of {totalPages || 1}
        </span>

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={!canNextPage || isLoading}
          className="btn-ghost btn-icon btn-xs disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="Next page"
        >
          <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none">
            <path d="M6 3L11 8L6 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <button
          onClick={() => onPageChange(totalPages - 1)}
          disabled={!canNextPage || isLoading}
          className="btn-ghost btn-icon btn-xs disabled:opacity-30 disabled:cursor-not-allowed"
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
  pageIndex?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  className?: string;
}

export const GridStatusBar = memo(function GridStatusBar<TData extends GridRowData>({
  table,
  totalRowCount,
  isLoading = false,
  pageSize = 100,
  pageIndex = 0,
  onPageChange,
  onPageSizeChange,
  className,
}: GridStatusBarProps<TData>) {
  const selectedRowCount = Object.keys(table.getState().rowSelection).length;
  // Always show pagination controls if onPageSizeChange is provided (meaning we want pagination UI)
  const showPagination = !!onPageSizeChange;

  // Use explicit props for pagination state (more reliable than reading from table)
  const currentPage = pageIndex;
  const currentPageSize = pageSize;
  const totalPages = Math.ceil(totalRowCount / (currentPageSize || pageSize)) || 1;

  // For non-paginated (virtualized) mode, show all rows
  const startRow = showPagination ? currentPage * (currentPageSize || pageSize) + 1 : 1;
  const endRow = showPagination
    ? Math.min((currentPage + 1) * (currentPageSize || pageSize), totalRowCount)
    : totalRowCount;

  const handlePageChange = useCallback(
    (page: number) => {
      // Only call the callback - let parent manage state
      onPageChange?.(page);
    },
    [onPageChange]
  );

  const handlePageSizeChange = useCallback(
    (size: number) => {
      // Only call the callback - let parent manage state
      onPageSizeChange?.(size);
    },
    [onPageSizeChange]
  );

  // Format large numbers
  const formatNumber = (num: number): string => {
    return new Intl.NumberFormat().format(num);
  };

  return (
    <div
      className={cn(
        'flex items-center justify-between px-4',
        'border-t border-border bg-card',
        'text-sm',
        className
      )}
      style={{
        height: 'var(--grid-status-bar-height)',
        minHeight: 'var(--grid-status-bar-height)',
        flexShrink: 0,
      }}
    >
      {/* Left: Row count and selection */}
      <div className="flex items-center gap-4">
        {/* Loading indicator */}
        {isLoading && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span>Loading...</span>
          </div>
        )}

        {/* Row count */}
        {!isLoading && (
          <span className="text-muted-foreground">
            {showPagination ? (
              <>
                Showing {formatNumber(startRow)}-{formatNumber(endRow)} of{' '}
                <span className="font-medium text-foreground">
                  {formatNumber(totalRowCount)}
                </span>
              </>
            ) : (
              <>
                <span className="font-medium text-foreground">
                  {formatNumber(totalRowCount)}
                </span>{' '}
                total rows
              </>
            )}
          </span>
        )}

        {/* Selection count */}
        {selectedRowCount > 0 && (
          <span className="text-primary">
            {formatNumber(selectedRowCount)} selected
          </span>
        )}
      </div>

      {/* Right: Pagination controls */}
      {showPagination && (
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
