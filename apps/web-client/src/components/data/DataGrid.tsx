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

  // Render header cell
  const renderHeaderCell = (column: ColumnDef<T>) => {
    const sortState = sort.find((s) => s.column === column.id);
    const width = columnWidths[column.id] || column.width;

    return (
      <th
        key={column.id}
        className={`px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800/50 ${
          column.frozen ? 'sticky left-0 z-10' : ''
        } ${stickyHeader ? 'sticky top-0 z-20' : ''}`}
        style={{ width, minWidth: column.minWidth, maxWidth: column.maxWidth }}
      >
        <div className="flex items-center gap-2">
          {column.sortable !== false && onSortChange ? (
            <button
              onClick={() => handleSort(column.id)}
              className="flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-200"
            >
              <span>{column.header}</span>
              {sortState ? (
                sortState.direction === 'asc' ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )
              ) : (
                <div className="w-4 h-4 opacity-0 group-hover:opacity-50">
                  <ChevronUp className="w-4 h-4" />
                </div>
              )}
            </button>
          ) : (
            <span>{column.header}</span>
          )}
        </div>
        {column.resizable !== false && (
          <div
            className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-indigo-500"
            onMouseDown={(e) => handleResizeStart(e, column.id)}
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

    return (
      <td
        key={column.id}
        className={`px-4 py-3 text-sm text-gray-900 dark:text-gray-100 ${
          column.frozen ? 'sticky left-0 bg-white dark:bg-gray-900 z-10' : ''
        } ${column.align === 'center' ? 'text-center' : column.align === 'right' ? 'text-right' : ''} ${cellClass}`}
        style={{
          width: columnWidths[column.id] || column.width,
          minWidth: column.minWidth,
          maxWidth: column.maxWidth,
        }}
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
    <div className={`flex flex-col h-full ${className}`}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <div className="flex items-center gap-3">
          {searchable && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder={searchPlaceholder}
                className="pl-9 pr-8 py-2 w-64 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              {searchQuery && (
                <button
                  onClick={() => handleSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                >
                  <X className="w-4 h-4 text-gray-400 hover:text-gray-600" />
                </button>
              )}
            </div>
          )}

          {selectable && selectedRows.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg">
              <span className="text-sm text-indigo-600 dark:text-indigo-400 font-medium">
                {selectedRows.length} selected
              </span>
              {bulkActions}
            </div>
          )}

          {toolbar}
        </div>

        <div className="flex items-center gap-2">
          {filters.length > 0 && (
            <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg">
              <Filter className="w-4 h-4" />
              {filters.length} filter{filters.length !== 1 ? 's' : ''}
            </button>
          )}

          <div className="relative">
            <button
              onClick={() => setShowColumnPicker(!showColumnPicker)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              title="Toggle columns"
            >
              <Columns className="w-4 h-4 text-gray-500" />
            </button>

            {showColumnPicker && (
              <div className="absolute right-0 top-10 w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-2 z-30">
                <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Show Columns
                  </span>
                </div>
                {columns.map((col) => (
                  <label
                    key={col.id}
                    className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
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
                      className="w-4 h-4 text-indigo-600 rounded"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">{col.header}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={loading}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 text-gray-500 ${loading ? 'animate-spin' : ''}`} />
            </button>
          )}

          {onExport && (
            <button
              onClick={onExport}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              title="Export"
            >
              <Download className="w-4 h-4 text-gray-500" />
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {selectable && (
                <th className="w-12 px-4 py-3 bg-gray-50 dark:bg-gray-800/50 sticky top-0 left-0 z-30">
                  <input
                    type="checkbox"
                    checked={data.length > 0 && selectedRows.length === data.length}
                    onChange={handleSelectAll}
                    className="w-4 h-4 text-indigo-600 rounded"
                  />
                </th>
              )}
              {visibleColumns.map(renderHeaderCell)}
              {rowActions && (
                <th className="w-12 px-4 py-3 bg-gray-50 dark:bg-gray-800/50 sticky top-0 right-0 z-20" />
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {loading ? (
              <tr>
                <td
                  colSpan={visibleColumns.length + (selectable ? 1 : 0) + (rowActions ? 1 : 0)}
                  className="px-4 py-12 text-center"
                >
                  <Loader2 className="w-8 h-8 mx-auto text-indigo-600 animate-spin" />
                  <p className="mt-2 text-sm text-gray-500">Loading...</p>
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td
                  colSpan={visibleColumns.length + (selectable ? 1 : 0) + (rowActions ? 1 : 0)}
                  className="px-4 py-12 text-center text-gray-500"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((row) => {
                const key = getRowKey(row);
                const isSelected = selectedRows.includes(key);

                return (
                  <tr
                    key={key}
                    onClick={() => onRowClick?.(row)}
                    onDoubleClick={() => onRowDoubleClick?.(row)}
                    className={`hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${
                      onRowClick || onRowDoubleClick ? 'cursor-pointer' : ''
                    } ${isSelected ? 'bg-indigo-50 dark:bg-indigo-900/20' : ''}`}
                  >
                    {selectable && (
                      <td
                        className="w-12 px-4 py-3 sticky left-0 bg-inherit"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleSelectRow(row)}
                          className="w-4 h-4 text-indigo-600 rounded"
                        />
                      </td>
                    )}
                    {visibleColumns.map((col) => renderCell(row, col))}
                    {rowActions && (
                      <td
                        className="w-12 px-4 py-3 sticky right-0 bg-inherit"
                        onClick={(e) => e.stopPropagation()}
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
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Showing {showingFrom} to {showingTo} of {pagination.total} results
            </span>
            <select
              value={pagination.pageSize}
              onChange={(e) => onPageSizeChange?.(Number(e.target.value))}
              className="px-2 py-1 border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-800 text-sm"
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size} per page
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => onPageChange?.(1)}
              disabled={pagination.page === 1}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded disabled:opacity-50"
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => onPageChange?.(pagination.page - 1)}
              disabled={pagination.page === 1}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded disabled:opacity-50"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-1 mx-2">
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

                return (
                  <button
                    key={pageNum}
                    onClick={() => onPageChange?.(pageNum)}
                    className={`w-8 h-8 text-sm rounded ${
                      pageNum === pagination.page
                        ? 'bg-indigo-600 text-white'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => onPageChange?.(pagination.page + 1)}
              disabled={pagination.page === totalPages}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded disabled:opacity-50"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => onPageChange?.(totalPages)}
              disabled={pagination.page === totalPages}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded disabled:opacity-50"
            >
              <ChevronsRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
