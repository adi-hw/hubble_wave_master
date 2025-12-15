import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { useModel } from '../../hooks/useModel';
import { TableHeader } from './TableHeader';
import { TableBody } from './TableBody';
import { PaginationControls } from './PaginationControls';
import { QueryBuilderBar } from './QueryBuilderBar';
import { ColumnPanel } from './ColumnPanel';
import { BulkActionBar } from './BulkActionBar';
import { BulkUpdateModal } from './BulkUpdateModal';
import { BulkDeleteModal } from './BulkDeleteModal';
import { TableColumn, FilterRule, generateFilterId } from './types';
import { useTableState } from './useTableState';
import { useFilterUrl } from './useFilterUrl';
import { useTableExport, ExportFormat } from './useTableExport';
import { Loader2, AlertCircle } from 'lucide-react';

interface DynamicTableProps {
  tableCode: string;
  tableLabel?: string;
  data: any[];
  onRowClick?: (row: any) => void;
  onRefresh?: () => void;
  onCreateNew?: () => void;
  /** Enable URL synchronization for shareable filters (default: true) */
  enableUrlSync?: boolean;
  /** Enable row selection with checkboxes (default: false) */
  selectable?: boolean;
  /** Get unique ID for a row (default: row.id) */
  getRowId?: (row: any) => string | number;
  /** Callback when bulk update is triggered */
  onBulkUpdate?: (selectedIds: (string | number)[], columnCode: string, newValue: any) => Promise<void>;
  /** Callback when bulk delete is triggered */
  onBulkDelete?: (selectedIds: (string | number)[]) => Promise<void>;
}

export const DynamicTable: React.FC<DynamicTableProps> = ({
  tableCode,
  tableLabel,
  data,
  onRowClick,
  onRefresh,
  onCreateNew,
  enableUrlSync = true,
  selectable = false,
  getRowId = (row) => row.id,
  onBulkUpdate,
  onBulkDelete,
}) => {
  const { fields, loading, error } = useModel(tableCode);
  const initialColumns: TableColumn[] = useMemo(
    () => fields.map((f) => ({ code: f.code, label: f.label, type: f.type, sortable: true })),
    [fields]
  );

  // URL sync hook - must be called before useTableState to get initial values
  const { initialState, updateUrl, copyShareableUrl } = useFilterUrl({
    enabled: enableUrlSync,
  });

  const {
    columns,
    setColumns,
    visibleColumns,
    search,
    setSearch,
    searchColumn,
    setSearchColumn,
    filterGroup,
    setFilterGroup,
    sortBy,
    sortDir,
    setSortBy,
    setSortDir,
    applyAll,
  } = useTableState(initialColumns);

  const [page, setPage] = useState(initialState.page);
  const [pageSize, setPageSize] = useState(initialState.pageSize);
  const [showColumnPanel, setShowColumnPanel] = useState(false);
  const [urlInitialized, setUrlInitialized] = useState(false);

  // Selection state
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string | number>>(new Set());
  const [showBulkUpdateModal, setShowBulkUpdateModal] = useState(false);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);

  // Initialize state from URL on first load (after fields are loaded)
  useEffect(() => {
    if (!loading && fields.length > 0 && !urlInitialized && enableUrlSync) {
      // Only apply URL state if there are actual filters in URL
      if (initialState.filterGroup.children.length > 0) {
        setFilterGroup(initialState.filterGroup);
      }
      if (initialState.search) {
        setSearch(initialState.search);
      }
      if (initialState.searchColumn) {
        setSearchColumn(initialState.searchColumn);
      }
      if (initialState.sortBy) {
        setSortBy(initialState.sortBy);
        setSortDir(initialState.sortDir);
      }
      setUrlInitialized(true);
    }
  }, [loading, fields, urlInitialized, enableUrlSync, initialState, setFilterGroup, setSearch, setSearchColumn, setSortBy, setSortDir]);

  // Sync state changes to URL
  useEffect(() => {
    if (urlInitialized && enableUrlSync) {
      updateUrl({
        filterGroup,
        search,
        searchColumn,
        sortBy,
        sortDir,
        page,
        pageSize,
      });
    }
  }, [urlInitialized, enableUrlSync, filterGroup, search, searchColumn, sortBy, sortDir, page, pageSize, updateUrl]);

  // Handler to copy shareable URL
  const handleShareFilter = useCallback(async () => {
    const success = await copyShareableUrl({
      filterGroup,
      search,
      searchColumn,
      sortBy,
      sortDir,
      page,
      pageSize,
    });
    return success;
  }, [copyShareableUrl, filterGroup, search, searchColumn, sortBy, sortDir, page, pageSize]);

  const filteredRows = useMemo(() => applyAll(data), [data, applyAll]);

  // Export hook - exports the filtered rows (not just current page)
  const { exportAs } = useTableExport({
    columns: visibleColumns,
    filename: tableLabel || tableCode,
    title: tableLabel,
  });

  // Handler for export - exports all filtered rows
  const handleExport = useCallback((format: ExportFormat) => {
    exportAs(format, filteredRows);
  }, [exportAs, filteredRows]);
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const pageRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, page, pageSize]);

  const handleSortChange = (code: string) => {
    if (sortBy !== code) {
      setSortBy(code);
      setSortDir('asc');
      return;
    }
    if (sortDir === 'asc') {
      setSortDir('desc');
    } else {
      setSortBy(null);
    }
  };

  // Handle quick filter from context menu on table cells
  const handleQuickFilter = useCallback((action: {
    column: TableColumn;
    value: any;
    operator: 'equals' | 'not_equals' | 'contains' | 'is_empty' | 'is_not_empty';
  }) => {
    const newRule: FilterRule = {
      id: generateFilterId(),
      field: action.column.code,
      operator: action.operator,
      value: action.operator === 'is_empty' || action.operator === 'is_not_empty'
        ? ''
        : String(action.value ?? ''),
    };
    setFilterGroup({
      ...filterGroup,
      children: [...filterGroup.children, newRule],
    });
    setPage(1);
  }, [filterGroup, setFilterGroup]);

  // Clear selection when filters/search change
  useEffect(() => {
    setSelectedRowIds(new Set());
  }, [filterGroup, search, searchColumn]);

  // Bulk action handlers
  const handleClearSelection = useCallback(() => {
    setSelectedRowIds(new Set());
  }, []);

  const handleBulkUpdate = useCallback(async (columnCode: string, newValue: any) => {
    if (!onBulkUpdate) return;
    const selectedIds = Array.from(selectedRowIds);
    await onBulkUpdate(selectedIds, columnCode, newValue);
    setSelectedRowIds(new Set());
    onRefresh?.();
  }, [selectedRowIds, onBulkUpdate, onRefresh]);

  const handleBulkDelete = useCallback(async () => {
    if (!onBulkDelete) return;
    const selectedIds = Array.from(selectedRowIds);
    await onBulkDelete(selectedIds);
    setSelectedRowIds(new Set());
    onRefresh?.();
  }, [selectedRowIds, onBulkDelete, onRefresh]);

  const handleBulkExport = useCallback(() => {
    // Export only selected rows
    const selectedRows = filteredRows.filter(row => selectedRowIds.has(getRowId(row)));
    exportAs('xlsx', selectedRows);
  }, [filteredRows, selectedRowIds, getRowId, exportAs]);

  if (loading) {
    return (
      <div
        className="h-[calc(100vh-8rem)] min-h-[500px] flex flex-col items-center justify-center rounded-xl"
        style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-default)',
        }}
      >
        <Loader2
          className="h-10 w-10 animate-spin mb-4"
          style={{ color: 'var(--text-brand)' }}
        />
        <p className="text-base" style={{ color: 'var(--text-muted)' }}>
          Loading table data...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="h-[calc(100vh-8rem)] min-h-[500px] flex flex-col items-center justify-center rounded-xl"
        style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-danger)',
        }}
      >
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
          style={{ backgroundColor: 'var(--bg-danger-subtle)' }}
        >
          <AlertCircle className="h-8 w-8" style={{ color: 'var(--text-danger)' }} />
        </div>
        <p className="text-base font-medium" style={{ color: 'var(--text-danger)' }}>
          Failed to load table
        </p>
        <p className="text-sm mt-1" style={{ color: 'var(--text-danger)' }}>
          {error}
        </p>
        {onRefresh && (
          <button onClick={onRefresh} className="mt-6 btn btn-secondary">
            Try again
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      className="h-[calc(100vh-8rem)] min-h-[500px] w-full flex rounded-xl overflow-hidden"
      style={{
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border-default)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      {/* Main Table Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Bulk Action Bar - Shows when rows are selected */}
        {selectable && selectedRowIds.size > 0 && (
          <BulkActionBar
            selectedCount={selectedRowIds.size}
            totalCount={filteredRows.length}
            onClearSelection={handleClearSelection}
            onBulkUpdate={onBulkUpdate ? () => setShowBulkUpdateModal(true) : undefined}
            onBulkDelete={onBulkDelete ? () => setShowBulkDeleteModal(true) : undefined}
            onBulkExport={handleBulkExport}
          />
        )}

        {/* Fixed Header - Hidden when bulk action bar is visible */}
        {(!selectable || selectedRowIds.size === 0) && (
          <TableHeader
            title={tableLabel}
            columns={columns}
            onColumnsChange={setColumns}
            search={search}
            onSearchChange={(val) => {
              setSearch(val);
              setPage(1);
            }}
            searchColumn={searchColumn}
            onSearchColumnChange={(col) => {
              setSearchColumn(col);
              setPage(1);
            }}
            filterCount={filterGroup.children.length}
            onRefresh={onRefresh}
            onCreateNew={onCreateNew}
            onShare={enableUrlSync ? handleShareFilter : undefined}
            onExport={handleExport}
            activePanel={showColumnPanel ? 'columns' : 'none'}
            onPanelChange={(panel) => setShowColumnPanel(panel === 'columns')}
          />
        )}

        {/* Horizontal Query Builder Bar */}
        <QueryBuilderBar
          fields={columns.map((c) => ({ code: c.code, label: c.label, type: c.type }))}
          filterGroup={filterGroup}
          onChange={(group) => {
            setFilterGroup(group);
            setPage(1);
          }}
        />

        {/* Scrollable Table Body - Takes remaining height */}
        <TableBody
          columns={visibleColumns}
          rows={pageRows}
          sortBy={sortBy}
          sortDir={sortDir}
          onSortChange={handleSortChange}
          onRowClick={onRowClick}
          onQuickFilter={handleQuickFilter}
          selectable={selectable}
          selectedRowIds={selectedRowIds}
          onSelectionChange={setSelectedRowIds}
          getRowId={getRowId}
        />

        {/* Fixed Footer */}
        <PaginationControls
          page={page}
          totalPages={totalPages}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          totalItems={filteredRows.length}
          currentCount={pageRows.length}
        />
      </div>

      {/* Side Panel - Columns only */}
      {showColumnPanel && (
        <div
          className="w-80 flex-shrink-0 animate-slide-in-right"
          style={{ borderLeft: '1px solid var(--border-default)' }}
        >
          <ColumnPanel
            columns={columns}
            onChange={setColumns}
            onClose={() => setShowColumnPanel(false)}
          />
        </div>
      )}

      {/* CSS for panel animation */}
      <style>{`
        @keyframes slide-in-right {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .animate-slide-in-right {
          animation: slide-in-right 0.2s ease-out;
        }
      `}</style>

      {/* Bulk Update Modal */}
      {selectable && (
        <BulkUpdateModal
          isOpen={showBulkUpdateModal}
          onClose={() => setShowBulkUpdateModal(false)}
          columns={visibleColumns}
          selectedCount={selectedRowIds.size}
          onUpdate={handleBulkUpdate}
        />
      )}

      {/* Bulk Delete Confirmation Modal */}
      {selectable && (
        <BulkDeleteModal
          isOpen={showBulkDeleteModal}
          onClose={() => setShowBulkDeleteModal(false)}
          selectedCount={selectedRowIds.size}
          onDelete={handleBulkDelete}
        />
      )}
    </div>
  );
};
