import React, { useState, useRef, useEffect, useCallback, memo } from 'react';
import ReactDOM from 'react-dom';
import { ArrowUpDown, ChevronDown, ChevronUp, Inbox, Filter, FilterX, Copy, Equal, Ban, Check, Minus } from 'lucide-react';
import { TableColumn } from './types';

interface QuickFilterAction {
  column: TableColumn;
  value: any;
  operator: 'equals' | 'not_equals' | 'contains' | 'is_empty' | 'is_not_empty';
}

interface TableBodyProps {
  columns: TableColumn[];
  rows: any[];
  sortBy: string | null;
  sortDir: 'asc' | 'desc';
  onSortChange: (column: string) => void;
  onRowClick?: (row: any) => void;
  onQuickFilter?: (action: QuickFilterAction) => void;
  // Selection props
  selectable?: boolean;
  selectedRowIds?: Set<string | number>;
  onSelectionChange?: (selectedIds: Set<string | number>) => void;
  getRowId?: (row: any) => string | number;
}

// Context Menu Component
interface ContextMenuProps {
  x: number;
  y: number;
  column: TableColumn;
  value: any;
  onFilter: (operator: QuickFilterAction['operator']) => void;
  onClose: () => void;
}

const ContextMenu: React.FC<ContextMenuProps> = memo(({ x, y, column, value, onFilter, onClose }) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const displayValue = value === null || value === undefined || value === ''
    ? '(empty)'
    : String(value).length > 30
      ? String(value).slice(0, 30) + '...'
      : String(value);
  const hasValue = value !== null && value !== undefined && value !== '';

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    // Use capture phase to handle click before other elements
    document.addEventListener('mousedown', handleClickOutside, true);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside, true);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  // Adjust position if menu would go off screen
  const adjustedX = Math.min(x, window.innerWidth - 220);
  const adjustedY = Math.min(y, window.innerHeight - 250);

  const menuContent = (
    <div
      ref={menuRef}
      className="fixed z-[9999] rounded-lg py-1 min-w-[200px] bg-card border border-border shadow-xl animate-in fade-in duration-100"
      style={{
        left: adjustedX,
        top: adjustedY,
      }}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Header */}
      <div className="px-3 py-2 border-b border-border/50">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/70">
          Filter by {column.label}
        </div>
        {hasValue && (
          <div className="text-xs mt-0.5 truncate text-muted-foreground" title={String(value)}>
            "{displayValue}"
          </div>
        )}
      </div>

      {/* Filter Options */}
      <div className="py-1">
        {hasValue && (
          <>
            <button
              type="button"
              onClick={() => onFilter('equals')}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors text-muted-foreground hover:bg-primary/10 hover:text-primary"
            >
              <Equal className="h-4 w-4 text-muted-foreground/70" />
              <span>Filter by this value</span>
            </button>
            <button
              type="button"
              onClick={() => onFilter('not_equals')}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors text-muted-foreground hover:bg-primary/10 hover:text-primary"
            >
              <Ban className="h-4 w-4 text-muted-foreground/70" />
              <span>Exclude this value</span>
            </button>
            <button
              type="button"
              onClick={() => onFilter('contains')}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors text-muted-foreground hover:bg-primary/10 hover:text-primary"
            >
              <Filter className="h-4 w-4 text-muted-foreground/70" />
              <span>Contains this value</span>
            </button>
          </>
        )}

        <div className="my-1 border-t border-border/50" />

        <button
          type="button"
          onClick={() => onFilter('is_empty')}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors text-muted-foreground hover:bg-primary/10 hover:text-primary"
        >
          <FilterX className="h-4 w-4 text-muted-foreground/70" />
          <span>Show empty values</span>
        </button>
        <button
          type="button"
          onClick={() => onFilter('is_not_empty')}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors text-muted-foreground hover:bg-primary/10 hover:text-primary"
        >
          <Filter className="h-4 w-4 text-muted-foreground/70" />
          <span>Show non-empty values</span>
        </button>

        {hasValue && (
          <>
            <div className="my-1 border-t border-border/50" />
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(String(value));
                onClose();
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors text-muted-foreground hover:bg-muted"
            >
              <Copy className="h-4 w-4 text-muted-foreground/70" />
              <span>Copy value</span>
            </button>
          </>
        )}
      </div>
    </div>
  );

  // Use portal to render outside the table container
  return ReactDOM.createPortal(menuContent, document.body);
});

export const TableBody: React.FC<TableBodyProps> = ({
  columns,
  rows,
  sortBy,
  sortDir,
  onSortChange,
  onRowClick,
  onQuickFilter,
  selectable = false,
  selectedRowIds = new Set(),
  onSelectionChange,
  getRowId = (row) => row.id,
}) => {
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    column: TableColumn;
    value: any;
  } | null>(null);

  // Selection handlers
  const handleSelectAll = useCallback(() => {
    if (!onSelectionChange) return;

    const allIds = rows.map(getRowId);
    const allSelected = allIds.every(id => selectedRowIds.has(id));

    if (allSelected) {
      // Deselect all
      onSelectionChange(new Set());
    } else {
      // Select all
      onSelectionChange(new Set(allIds));
    }
  }, [rows, selectedRowIds, onSelectionChange, getRowId]);

  const handleSelectRow = useCallback((row: any, e: React.MouseEvent) => {
    if (!onSelectionChange) return;
    e.stopPropagation();

    const id = getRowId(row);
    const newSelection = new Set(selectedRowIds);

    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }

    onSelectionChange(newSelection);
  }, [selectedRowIds, onSelectionChange, getRowId]);

  // Compute selection state
  const allIds = rows.map(getRowId);
  const selectedCount = allIds.filter(id => selectedRowIds.has(id)).length;
  const isAllSelected = rows.length > 0 && selectedCount === rows.length;
  const isPartiallySelected = selectedCount > 0 && selectedCount < rows.length;

  // Memoize close handler to prevent unnecessary re-renders
  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent, col: TableColumn, value: any) => {
    if (!onQuickFilter) return;
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      column: col,
      value,
    });
  }, [onQuickFilter]);

  const handleQuickFilter = useCallback((operator: QuickFilterAction['operator']) => {
    if (contextMenu && onQuickFilter) {
      onQuickFilter({
        column: contextMenu.column,
        value: contextMenu.value,
        operator,
      });
    }
    setContextMenu(null);
  }, [contextMenu, onQuickFilter]);

  const renderValue = (row: any, col: TableColumn) => {
    const raw = row.attributes?.[col.code] ?? row[col.code];
    const fieldType = col.type?.toLowerCase() || '';

    if (raw === null || raw === undefined || raw === '') {
      return <span className="text-muted-foreground/70">—</span>;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // BOOLEAN
    // ═══════════════════════════════════════════════════════════════════════════
    if (fieldType === 'boolean' || typeof raw === 'boolean') {
      return (
        <span className={`badge ${raw ? 'badge-success' : 'badge-neutral'}`}>
          {raw ? 'Yes' : 'No'}
        </span>
      );
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // ARRAYS (multi_choice, tags, multi_reference)
    // ═══════════════════════════════════════════════════════════════════════════
    if (Array.isArray(raw)) {
      return (
        <div className="flex flex-wrap gap-1">
          {raw.slice(0, 3).map((item, i) => (
            <span key={i} className="badge-neutral text-[11px]">
              {typeof item === 'object' ? item.label || item.name || item.id : String(item)}
            </span>
          ))}
          {raw.length > 3 && (
            <span className="badge-neutral text-[11px]">+{raw.length - 3}</span>
          )}
        </div>
      );
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // DATE TYPES
    // ═══════════════════════════════════════════════════════════════════════════
    if (fieldType === 'date') {
      try {
        return <span className="text-foreground">{new Date(raw).toLocaleDateString()}</span>;
      } catch {
        return <span className="text-foreground">{String(raw)}</span>;
      }
    }

    if (fieldType === 'datetime' || fieldType === 'timestamp') {
      try {
        return <span className="text-foreground">{new Date(raw).toLocaleString()}</span>;
      } catch {
        return <span className="text-foreground">{String(raw)}</span>;
      }
    }

    if (fieldType === 'time') {
      return <span className="font-mono text-xs text-foreground">{String(raw)}</span>;
    }

    if (fieldType === 'duration') {
      const str = String(raw);
      if (str.match(/^\d+:\d+$/)) {
        const [h, m] = str.split(':').map(Number);
        return <span className="text-foreground">{h}h {m}m</span>;
      }
      return <span className="text-foreground">{str}</span>;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // NUMERIC TYPES
    // ═══════════════════════════════════════════════════════════════════════════
    if (fieldType === 'currency') {
      const num = typeof raw === 'number' ? raw : parseFloat(raw);
      if (!isNaN(num)) {
        return <span className="font-medium text-foreground">${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>;
      }
    }

    if (fieldType === 'percent') {
      const num = typeof raw === 'number' ? raw : parseFloat(raw);
      if (!isNaN(num)) {
        return <span className="text-foreground">{num}%</span>;
      }
    }

    if (fieldType === 'integer' || fieldType === 'long') {
      const num = typeof raw === 'number' ? raw : parseInt(raw);
      if (!isNaN(num)) {
        return <span className="font-mono text-foreground">{num.toLocaleString()}</span>;
      }
    }

    if (fieldType === 'decimal' || fieldType === 'number') {
      const num = typeof raw === 'number' ? raw : parseFloat(raw);
      if (!isNaN(num)) {
        return <span className="font-mono text-foreground">{num.toLocaleString()}</span>;
      }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // COMMUNICATION TYPES
    // ═══════════════════════════════════════════════════════════════════════════
    if (fieldType === 'email') {
      return (
        <a href={`mailto:${raw}`} className="hover:underline truncate max-w-xs block text-primary" onClick={(e) => e.stopPropagation()}>
          {String(raw)}
        </a>
      );
    }

    if (fieldType === 'url') {
      return (
        <a href={String(raw)} target="_blank" rel="noopener noreferrer" className="hover:underline truncate max-w-xs block text-primary" onClick={(e) => e.stopPropagation()}>
          {String(raw).replace(/^https?:\/\//, '')}
        </a>
      );
    }

    if (fieldType === 'phone') {
      return (
        <a href={`tel:${raw}`} className="hover:underline text-primary" onClick={(e) => e.stopPropagation()}>
          {String(raw)}
        </a>
      );
    }

    if (fieldType === 'ip_address') {
      return <span className="font-mono text-xs text-foreground">{String(raw)}</span>;
    }

    if (fieldType === 'mac_address') {
      return <span className="font-mono text-xs uppercase text-foreground">{String(raw)}</span>;
    }

    if (fieldType === 'color') {
      return (
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded border border-border" style={{ backgroundColor: String(raw) }} />
          <span className="font-mono text-xs uppercase text-muted-foreground">{String(raw)}</span>
        </div>
      );
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // REFERENCE TYPES
    // ═══════════════════════════════════════════════════════════════════════════
    if (fieldType === 'reference' || fieldType === 'user_reference' || fieldType === 'group_reference' || fieldType === 'location_reference') {
      if (typeof raw === 'object' && raw !== null) {
        return <span className="text-foreground">{raw.label || raw.name || raw.id}</span>;
      }
      return <span className="text-xs font-mono text-muted-foreground/70">{String(raw).slice(0, 8)}...</span>;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // STRUCTURED TYPES (JSON, key_value)
    // ═══════════════════════════════════════════════════════════════════════════
    if (fieldType === 'json' || fieldType === 'key_value') {
      if (typeof raw === 'object') {
        const entries = Object.entries(raw);
        if (entries.length === 0) {
          return <span className="text-muted-foreground/70">{'{ }'}</span>;
        }
        return (
          <span className="text-xs font-mono text-muted-foreground/70" title={JSON.stringify(raw, null, 2)}>
            {entries.length} key{entries.length !== 1 ? 's' : ''}
          </span>
        );
      }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // SECURITY / ENCRYPTED TYPES
    // ═══════════════════════════════════════════════════════════════════════════
    if (fieldType === 'password_hashed' || fieldType === 'secret_encrypted') {
      return <span className="text-muted-foreground/70">••••••••</span>;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // IDENTITY TYPES
    // ═══════════════════════════════════════════════════════════════════════════
    if (fieldType === 'guid' || fieldType === 'auto_number') {
      return <span className="text-xs font-mono text-muted-foreground/70">{String(raw)}</span>;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PROCESS FLOW STAGE
    // ═══════════════════════════════════════════════════════════════════════════
    if (fieldType === 'process_flow_stage') {
      const stage = typeof raw === 'object' ? (raw.label || raw.name) : String(raw);
      return <span className="badge badge-primary">{stage}</span>;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // GEO POINT
    // ═══════════════════════════════════════════════════════════════════════════
    if (fieldType === 'geo_point') {
      if (typeof raw === 'object' && raw.lat !== undefined && raw.lng !== undefined) {
        return <span className="text-xs font-mono text-muted-foreground/70">{raw.lat.toFixed(4)}, {raw.lng.toFixed(4)}</span>;
      }
      return <span className="text-xs font-mono text-muted-foreground/70">{String(raw)}</span>;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // MEDIA TYPES
    // ═══════════════════════════════════════════════════════════════════════════
    if (fieldType === 'image') {
      if (typeof raw === 'string' && raw.startsWith('http')) {
        return (
          <div className="w-10 h-10 rounded overflow-hidden border border-border">
            <img src={raw} alt="" className="w-full h-full object-cover" />
          </div>
        );
      }
      if (typeof raw === 'object' && raw.url) {
        return (
          <div className="w-10 h-10 rounded overflow-hidden border border-border">
            <img src={raw.url} alt={raw.name || ''} className="w-full h-full object-cover" />
          </div>
        );
      }
    }

    if (fieldType === 'file' || fieldType === 'audio' || fieldType === 'video') {
      if (typeof raw === 'object' && raw.name) {
        return <span className="truncate max-w-xs block text-foreground">{raw.name}</span>;
      }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // OBJECTS (fallback)
    // ═══════════════════════════════════════════════════════════════════════════
    if (typeof raw === 'object') {
      return (
        <span className="text-xs font-mono text-muted-foreground/70" title={JSON.stringify(raw)}>
          {JSON.stringify(raw).slice(0, 40)}...
        </span>
      );
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // STATUS-LIKE FIELDS (by column name)
    // ═══════════════════════════════════════════════════════════════════════════
    if (col.code.toLowerCase().includes('status')) {
      const status = String(raw).toLowerCase();
      const statusClass =
        status === 'active'
          ? 'badge-success'
          : status === 'inactive' || status === 'disabled'
            ? 'badge-neutral'
            : status === 'pending'
              ? 'badge-warning'
              : status === 'error' || status === 'failed'
                ? 'badge-danger'
                : 'badge-neutral';
      return <span className={statusClass}>{String(raw)}</span>;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // DEFAULT TEXT
    // ═══════════════════════════════════════════════════════════════════════════
    return (
      <span className="truncate max-w-xs block text-foreground">{String(raw)}</span>
    );
  };

  const SortIcon = ({ column }: { column: string }) => {
    if (sortBy !== column) {
      return (
        <ArrowUpDown className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground/70" />
      );
    }
    return sortDir === 'asc' ? (
      <ChevronUp className="h-3.5 w-3.5 text-primary" />
    ) : (
      <ChevronDown className="h-3.5 w-3.5 text-primary" />
    );
  };

  return (
    <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
      {/* Table Container with custom scrollbar */}
      <div className="flex-1 overflow-auto scrollbar-modern">
        <table className="min-w-full">
          {/* Sticky Header */}
          <thead className="sticky top-0 z-10">
            <tr className="bg-muted border-b-2 border-border">
              {/* Checkbox Column Header */}
              {selectable && (
                <th className="w-12 px-4 py-3.5">
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                      isAllSelected
                        ? 'bg-primary border-primary text-primary-foreground'
                        : isPartiallySelected
                          ? 'bg-primary/20 border-primary text-primary'
                          : 'bg-transparent border-border text-primary'
                    }`}
                    title={isAllSelected ? 'Deselect all' : 'Select all'}
                  >
                    {isAllSelected && <Check className="h-3.5 w-3.5" />}
                    {isPartiallySelected && <Minus className="h-3.5 w-3.5" />}
                  </button>
                </th>
              )}
              {columns.map((col) => (
                <th key={col.code} className="px-4 py-3.5 text-left whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => onSortChange(col.code)}
                    className="group flex items-center gap-2 text-xs font-semibold uppercase tracking-wider transition-colors text-muted-foreground/70 hover:text-foreground"
                  >
                    <span>{col.label}</span>
                    <SortIcon column={col.code} />
                  </button>
                </th>
              ))}
            </tr>
          </thead>

          {/* Table Body */}
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (selectable ? 1 : 0)} className="px-4 py-0">
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4 bg-muted">
                      <Inbox className="h-8 w-8 text-muted-foreground/70" />
                    </div>
                    <p className="text-base font-medium text-foreground">No records found</p>
                    <p className="text-sm mt-1 max-w-sm text-muted-foreground/70">
                      Try adjusting your search or filter criteria to find what you're looking for
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              rows.map((row, idx) => {
                const rowId = getRowId(row);
                const isSelected = selectedRowIds.has(rowId);

                return (
                  <tr
                    key={rowId ?? idx}
                    onClick={() => onRowClick?.(row)}
                    className={`group transition-all duration-150 border-b border-border/50 ${onRowClick ? 'cursor-pointer' : ''} ${
                      isSelected
                        ? 'bg-primary/10'
                        : idx % 2 === 0
                          ? 'bg-card hover:bg-muted/50'
                          : 'bg-muted hover:bg-muted/70'
                    }`}
                  >
                    {/* Row Checkbox */}
                    {selectable && (
                      <td className="w-12 px-4 py-3.5">
                        <button
                          type="button"
                          onClick={(e) => handleSelectRow(row, e)}
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                            isSelected
                              ? 'bg-primary border-primary text-primary-foreground'
                              : 'bg-transparent border-border'
                          }`}
                        >
                          {isSelected && <Check className="h-3.5 w-3.5" />}
                        </button>
                      </td>
                    )}
                    {columns.map((col) => {
                      const raw = row.attributes?.[col.code] ?? row[col.code];
                      return (
                        <td
                          key={col.code}
                          className={`px-4 py-3.5 text-sm align-middle transition-colors ${onQuickFilter ? 'cursor-context-menu' : ''}`}
                          onContextMenu={(e) => handleContextMenu(e, col, raw)}
                          title={onQuickFilter ? 'Right-click to filter' : undefined}
                        >
                          {renderValue(row, col)}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Context Menu - rendered via portal */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          column={contextMenu.column}
          value={contextMenu.value}
          onFilter={handleQuickFilter}
          onClose={closeContextMenu}
        />
      )}
    </div>
  );
};
