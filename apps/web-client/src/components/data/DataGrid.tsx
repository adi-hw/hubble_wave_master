/**
 * DataGrid Component
 * HubbleWave Platform - Phase 1
 *
 * A production-ready data grid with:
 * - Theme-aware styling using Tailwind CSS classes
 * - Full accessibility (ARIA labels, keyboard navigation)
 * - Mobile-responsive design
 * - Sorting, filtering, pagination
 * - Row selection and bulk actions
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Filter,
  Search,
  X,
  Download,
  Columns,
  RefreshCw,
  Loader2,
} from 'lucide-react';

// Types
export interface ColumnDef<T = unknown> {
  id: string;
  header: string;
  accessor: keyof T | ((row: T) => unknown);
  width?: number;
  minWidth?: number;
  maxWidth?: number;
  sortable?: boolean;
  filterable?: boolean;
  resizable?: boolean;
  frozen?: boolean;
  align?: 'left' | 'center' | 'right';
  formatter?: (value: unknown, row: T) => React.ReactNode;
  cellClassName?: string | ((row: T) => string);
}

export interface SortState {
  column: string;
  direction: 'asc' | 'desc';
}

export interface FilterState {
  column: string;
  operator: 'contains' | 'equals' | 'starts' | 'ends' | 'gt' | 'lt' | 'gte' | 'lte' | 'empty' | 'not_empty';
  value: string;
}

export interface PaginationState {
  page: number;
  pageSize: number;
  total: number;
}

export interface DataGridProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  loading?: boolean;
  pagination?: PaginationState;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  sort?: SortState[];
  onSortChange?: (sort: SortState[]) => void;
  filters?: FilterState[];
  onFiltersChange?: (filters: FilterState[]) => void;
  selectable?: boolean;
  selectedRows?: string[];
  onSelectionChange?: (selected: string[]) => void;
  rowKey?: keyof T | ((row: T) => string);
  onRowClick?: (row: T) => void;
  onRowDoubleClick?: (row: T) => void;
  emptyMessage?: string;
  className?: string;
  stickyHeader?: boolean;
  rowActions?: (row: T) => React.ReactNode;
  bulkActions?: React.ReactNode;
  searchable?: boolean;
  searchPlaceholder?: string;
  onSearch?: (query: string) => void;
  onRefresh?: () => void;
  onExport?: () => void;
  toolbar?: React.ReactNode;
}

const pageSizeOptions = [10, 20, 50, 100, 200];

export function DataGrid<T extends Record<string, unknown>>({
  data,
  columns,
  loading = false,
  pagination,
  onPageChange,
  onPageSizeChange,
  sort = [],
  onSortChange,
  filters = [],
  onFiltersChange: _onFiltersChange,
  selectable = false,
  selectedRows = [],
  onSelectionChange,
  rowKey = 'id' as keyof T,
  onRowClick,
  onRowDoubleClick,
  emptyMessage = 'No data available',
  className = '',
  stickyHeader = true,
  rowActions,
  bulkActions,
  searchable = false,
  searchPlaceholder = 'Search...',
  onSearch,
  onRefresh,
  onExport,
  toolbar,
}: DataGridProps<T>) {
  const [searchQuery, setSearchQuery] = useState('');
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());
  const [resizingColumn, setResizingColumn] = useState<string | null>(null);
  const [startX, setStartX] = useState(0);
  const [startWidth, setStartWidth] = useState(0);

  // Get row key
  const getRowKey = useCallback(
    (row: T): string => {
      if (typeof rowKey === 'function') {
        return rowKey(row);
      }
      return String(row[rowKey]);
    },
    [rowKey]
  );

  // Get cell value
  const getCellValue = useCallback((row: T, column: ColumnDef<T>): unknown => {
    if (typeof column.accessor === 'function') {
      return column.accessor(row);
    }
    return row[column.accessor as keyof T];
  }, []);

  // Visible columns
  const visibleColumns = useMemo(
    () => columns.filter((col) => !hiddenColumns.has(col.id)),
    [columns, hiddenColumns]
  );

  // Handle sort
  const handleSort = useCallback(
    (columnId: string) => {
      if (!onSortChange) return;

      const existingSort = sort.find((s) => s.column === columnId);
      let newSort: SortState[];

      if (!existingSort) {
        newSort = [{ column: columnId, direction: 'asc' }];
      } else if (existingSort.direction === 'asc') {
        newSort = [{ column: columnId, direction: 'desc' }];
      } else {
        newSort = [];
      }

      onSortChange(newSort);
    },
    [sort, onSortChange]
  );

  // Handle selection
  const handleSelectAll = useCallback(() => {
    if (!onSelectionChange) return;

    if (selectedRows.length === data.length) {
      onSelectionChange([]);
    } else {
      onSelectionChange(data.map(getRowKey));
    }
  }, [data, selectedRows, onSelectionChange, getRowKey]);

  const handleSelectRow = useCallback(
    (row: T) => {
      if (!onSelectionChange) return;

      const key = getRowKey(row);
      if (selectedRows.includes(key)) {
        onSelectionChange(selectedRows.filter((k) => k !== key));
      } else {
        onSelectionChange([...selectedRows, key]);
      }
    },
    [selectedRows, onSelectionChange, getRowKey]
  );

  // Handle column resize
  const handleResizeStart = (e: React.MouseEvent, columnId: string) => {
    e.preventDefault();
    setResizingColumn(columnId);
    setStartX(e.clientX);
    setStartWidth(columnWidths[columnId] || columns.find((c) => c.id === columnId)?.width || 150);
  };

  useEffect(() => {
    if (!resizingColumn) return;

    const handleMouseMove = (e: MouseEvent) => {
      const diff = e.clientX - startX;
      const newWidth = Math.max(50, startWidth + diff);
      setColumnWidths((prev) => ({ ...prev, [resizingColumn]: newWidth }));
    };

    const handleMouseUp = () => {
      setResizingColumn(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizingColumn, startX, startWidth]);

  // Search handler
  const handleSearch = useCallback(
    (value: string) => {
      setSearchQuery(value);
      onSearch?.(value);
    },
    [onSearch]
  );

  // Build inline style object for width constraints only
  const getColumnWidthStyle = (column: ColumnDef<T>) => {
    const width = columnWidths[column.id] || column.width;
    const result: React.CSSProperties = {};
    if (width) result.width = width;
    if (column.minWidth) result.minWidth = column.minWidth;
    if (column.maxWidth) result.maxWidth = column.maxWidth;
    return Object.keys(result).length > 0 ? result : undefined;
  };

  // Render header cell
  const renderHeaderCell = (column: ColumnDef<T>) => {
    const sortState = sort.find((s) => s.column === column.id);
    const widthStyle = getColumnWidthStyle(column);

    return (
      <th
        key={column.id}
        className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider bg-muted text-muted-foreground ${
          column.frozen ? 'sticky left-0 z-10' : ''
        } ${stickyHeader ? 'sticky top-0 z-20' : ''}`}
        style={widthStyle}
        role="columnheader"
        aria-sort={sortState ? (sortState.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
      >
        <div className="flex items-center gap-2">
          {column.sortable !== false && onSortChange ? (
            <button
              onClick={() => handleSort(column.id)}
              className="flex items-center gap-1 transition-colors text-muted-foreground hover:text-foreground"
              aria-label={`Sort by ${column.header}`}
            >
              <span>{column.header}</span>
              {sortState ? (
                sortState.direction === 'asc' ? (
                  <ChevronUp className="w-4 h-4" aria-hidden="true" />
                ) : (
                  <ChevronDown className="w-4 h-4" aria-hidden="true" />
                )
              ) : (
                <div className="w-4 h-4 opacity-0 group-hover:opacity-50">
                  <ChevronUp className="w-4 h-4" aria-hidden="true" />
                </div>
              )}
            </button>
          ) : (
            <span>{column.header}</span>
          )}
        </div>
        {column.resizable !== false && (
          <div
            className="absolute right-0 top-0 h-full w-1 cursor-col-resize transition-colors bg-transparent hover:bg-primary"
            onMouseDown={(e) => handleResizeStart(e, column.id)}
            role="separator"
            aria-orientation="vertical"
            aria-label={`Resize ${column.header} column`}
          />
        )}
      </th>
    );
  };

  // Render cell
  const renderCell = (row: T, column: ColumnDef<T>) => {
    const value = getCellValue(row, column);
    const content = column.formatter ? column.formatter(value, row) : String(value ?? '');
    const cellClass =
      typeof column.cellClassName === 'function'
        ? column.cellClassName(row)
        : column.cellClassName || '';
    const widthStyle = getColumnWidthStyle(column);

    return (
      <td
        key={column.id}
        className={`px-4 py-3 text-sm text-foreground ${
          column.frozen ? 'sticky left-0 z-10 bg-card' : ''
        } ${column.align === 'center' ? 'text-center' : column.align === 'right' ? 'text-right' : ''} ${cellClass}`}
        style={widthStyle}
      >
        {content}
      </td>
    );
  };

  const totalPages = pagination ? Math.ceil(pagination.total / pagination.pageSize) : 1;
  const showingFrom = pagination ? (pagination.page - 1) * pagination.pageSize + 1 : 1;
  const showingTo = pagination
    ? Math.min(pagination.page * pagination.pageSize, pagination.total)
    : data.length;

  return (
    <div
      className={`flex flex-col h-full ${className}`}
      role="grid"
      aria-label="Data grid"
      aria-busy={loading}
    >
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 flex-wrap gap-3 border-b border-border bg-card">
        <div className="flex items-center gap-3 flex-wrap">
          {searchable && (
            <div className="relative">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"
                aria-hidden="true"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder={searchPlaceholder}
                aria-label="Search data"
                className="pl-9 pr-8 py-2 w-64 rounded-lg text-sm focus:outline-none transition-colors border border-border bg-card text-foreground focus:border-primary"
              />
              {searchQuery && (
                <button
                  onClick={() => handleSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded transition-colors text-muted-foreground hover:text-foreground"
                  aria-label="Clear search"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              )}
            </div>
          )}

          {selectable && selectedRows.length > 0 && (
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10 text-primary"
              role="status"
              aria-live="polite"
            >
              <span className="text-sm font-medium">
                {selectedRows.length} selected
              </span>
              {bulkActions}
            </div>
          )}

          {toolbar}
        </div>

        <div className="flex items-center gap-2">
          {filters.length > 0 && (
            <button
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors bg-primary/10 text-primary"
              aria-label={`${filters.length} active filters`}
            >
              <Filter className="w-4 h-4" aria-hidden="true" />
              {filters.length} filter{filters.length !== 1 ? 's' : ''}
            </button>
          )}

          <div className="relative">
            <button
              onClick={() => setShowColumnPicker(!showColumnPicker)}
              className="p-2 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center text-muted-foreground hover:bg-muted"
              title="Toggle columns"
              aria-label="Toggle column visibility"
              aria-expanded={showColumnPicker}
              aria-haspopup="menu"
            >
              <Columns className="w-4 h-4" aria-hidden="true" />
            </button>

            {showColumnPicker && (
              <div
                className="absolute right-0 top-12 w-56 rounded-lg shadow-lg py-2 z-30 bg-card border border-border"
                role="menu"
                aria-label="Column visibility options"
              >
                <div className="px-3 py-2 border-b border-border">
                  <span className="text-sm font-medium text-foreground">
                    Show Columns
                  </span>
                </div>
                {columns.map((col) => (
                  <label
                    key={col.id}
                    className="flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors text-foreground hover:bg-muted"
                    role="menuitemcheckbox"
                    aria-checked={!hiddenColumns.has(col.id)}
                  >
                    <input
                      type="checkbox"
                      checked={!hiddenColumns.has(col.id)}
                      onChange={() => {
                        const newHidden = new Set(hiddenColumns);
                        if (newHidden.has(col.id)) {
                          newHidden.delete(col.id);
                        } else {
                          newHidden.add(col.id);
                        }
                        setHiddenColumns(newHidden);
                      }}
                      className="w-4 h-4 rounded accent-primary"
                      aria-label={`Show ${col.header} column`}
                    />
                    <span className="text-sm">{col.header}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={loading}
              className="p-2 rounded-lg transition-colors disabled:opacity-50 min-h-[44px] min-w-[44px] flex items-center justify-center text-muted-foreground hover:bg-muted"
              title="Refresh"
              aria-label="Refresh data"
            >
              <RefreshCw
                className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
            </button>
          )}

          {onExport && (
            <button
              onClick={onExport}
              className="p-2 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center text-muted-foreground hover:bg-muted"
              title="Export"
              aria-label="Export data"
            >
              <Download className="w-4 h-4" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto" role="region" aria-label="Data table">
        <table className="w-full border-collapse" role="grid">
          <thead>
            <tr role="row">
              {selectable && (
                <th
                  className="w-12 px-4 py-3 sticky top-0 left-0 z-30 bg-muted"
                  role="columnheader"
                >
                  <input
                    type="checkbox"
                    checked={data.length > 0 && selectedRows.length === data.length}
                    onChange={handleSelectAll}
                    className="w-4 h-4 rounded accent-primary"
                    aria-label="Select all rows"
                  />
                </th>
              )}
              {visibleColumns.map(renderHeaderCell)}
              {rowActions && (
                <th
                  className="w-12 px-4 py-3 sticky top-0 right-0 z-20 bg-muted"
                  role="columnheader"
                  aria-label="Actions"
                />
              )}
            </tr>
          </thead>
          <tbody className="border-t border-border">
            {loading ? (
              <tr role="row">
                <td
                  colSpan={visibleColumns.length + (selectable ? 1 : 0) + (rowActions ? 1 : 0)}
                  className="px-4 py-12 text-center"
                  role="gridcell"
                >
                  <Loader2
                    className="w-8 h-8 mx-auto animate-spin text-primary"
                    aria-hidden="true"
                  />
                  <p
                    className="mt-2 text-sm text-muted-foreground"
                    role="status"
                    aria-live="polite"
                  >
                    Loading...
                  </p>
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr role="row">
                <td
                  colSpan={visibleColumns.length + (selectable ? 1 : 0) + (rowActions ? 1 : 0)}
                  className="px-4 py-12 text-center text-muted-foreground"
                  role="gridcell"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((row, rowIndex) => {
                const key = getRowKey(row);
                const isSelected = selectedRows.includes(key);

                return (
                  <tr
                    key={key}
                    onClick={() => onRowClick?.(row)}
                    onDoubleClick={() => onRowDoubleClick?.(row)}
                    className={`transition-colors border-b border-border/50 ${
                      isSelected ? 'bg-primary/10' : 'hover:bg-muted'
                    } ${onRowClick || onRowDoubleClick ? 'cursor-pointer' : 'cursor-default'}`}
                    role="row"
                    aria-selected={isSelected}
                    aria-rowindex={rowIndex + 1}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onRowClick?.(row);
                      }
                    }}
                  >
                    {selectable && (
                      <td
                        className="w-12 px-4 py-3 sticky left-0 bg-inherit"
                        onClick={(e) => e.stopPropagation()}
                        role="gridcell"
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleSelectRow(row)}
                          className="w-4 h-4 rounded accent-primary"
                          aria-label={`Select row ${key}`}
                        />
                      </td>
                    )}
                    {visibleColumns.map((col) => renderCell(row, col))}
                    {rowActions && (
                      <td
                        className="w-12 px-4 py-3 sticky right-0 bg-inherit"
                        onClick={(e) => e.stopPropagation()}
                        role="gridcell"
                      >
                        {rowActions(row)}
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination && (
        <div
          className="flex items-center justify-between px-4 py-3 flex-wrap gap-3 border-t border-border bg-card"
          role="navigation"
          aria-label="Pagination"
        >
          <div className="flex items-center gap-4">
            <span
              className="text-sm text-muted-foreground"
              aria-live="polite"
            >
              Showing {showingFrom} to {showingTo} of {pagination.total} results
            </span>
            <select
              value={pagination.pageSize}
              onChange={(e) => onPageSizeChange?.(Number(e.target.value))}
              className="px-2 py-1 rounded text-sm border border-border bg-card text-foreground"
              aria-label="Results per page"
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size} per page
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1" role="group" aria-label="Page navigation">
            <button
              onClick={() => onPageChange?.(1)}
              disabled={pagination.page === 1}
              className="p-2 rounded disabled:opacity-50 min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors text-muted-foreground hover:bg-muted disabled:hover:bg-transparent"
              aria-label="Go to first page"
            >
              <ChevronsLeft className="w-4 h-4" aria-hidden="true" />
            </button>
            <button
              onClick={() => onPageChange?.(pagination.page - 1)}
              disabled={pagination.page === 1}
              className="p-2 rounded disabled:opacity-50 min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors text-muted-foreground hover:bg-muted disabled:hover:bg-transparent"
              aria-label="Go to previous page"
            >
              <ChevronLeft className="w-4 h-4" aria-hidden="true" />
            </button>

            <div className="flex items-center gap-1 mx-2" role="group" aria-label="Page numbers">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (pagination.page <= 3) {
                  pageNum = i + 1;
                } else if (pagination.page >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = pagination.page - 2 + i;
                }

                const isCurrentPage = pageNum === pagination.page;

                return (
                  <button
                    key={pageNum}
                    onClick={() => onPageChange?.(pageNum)}
                    className={`w-10 h-10 text-sm rounded transition-colors ${
                      isCurrentPage
                        ? 'bg-primary text-primary-foreground'
                        : 'text-foreground hover:bg-muted'
                    }`}
                    aria-label={`Page ${pageNum}`}
                    aria-current={isCurrentPage ? 'page' : undefined}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => onPageChange?.(pagination.page + 1)}
              disabled={pagination.page === totalPages}
              className="p-2 rounded disabled:opacity-50 min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors text-muted-foreground hover:bg-muted disabled:hover:bg-transparent"
              aria-label="Go to next page"
            >
              <ChevronRight className="w-4 h-4" aria-hidden="true" />
            </button>
            <button
              onClick={() => onPageChange?.(totalPages)}
              disabled={pagination.page === totalPages}
              className="p-2 rounded disabled:opacity-50 min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors text-muted-foreground hover:bg-muted disabled:hover:bg-transparent"
              aria-label="Go to last page"
            >
              <ChevronsRight className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
