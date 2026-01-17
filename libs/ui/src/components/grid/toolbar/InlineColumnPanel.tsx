/**
 * InlineColumnPanel - Inline version of ColumnPickerModal
 *
 * Displays column visibility manager as an inline expandable panel instead of a modal.
 * Renders between the toolbar and the grid header.
 */

import React, { useCallback, useMemo, useState, useRef, useEffect } from 'react';
import { Table } from '@tanstack/react-table';
import { cn } from '../utils/cn';
import type { GridRowData, GridColumnType } from '../types';

// =============================================================================
// TYPES
// =============================================================================

interface InlineColumnPanelProps<TData extends GridRowData> {
  table: Table<TData>;
  isOpen: boolean;
  onClose: () => void;
  onColumnOrderChange?: (columnOrder: string[]) => void;
}

interface ColumnInfo {
  id: string;
  label: string;
  type: GridColumnType;
  isVisible: boolean;
}

// =============================================================================
// COLUMN TYPE ICONS
// =============================================================================

const getColumnTypeInfo = (type: GridColumnType): { icon: React.ReactNode; color: string } => {
  const config: Record<string, { icon: React.ReactNode; color: string }> = {
    text: {
      icon: (
        <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
          <path d="M2 3h12v2H9v8H7V5H2V3z" />
        </svg>
      ),
      color: 'var(--color-info-500)',
    },
    number: {
      icon: (
        <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
          <path d="M4 3h2v10H4V3zm6 0h2v10h-2V3zM2 7h4v2H2V7zm8 0h4v2h-4V7z" />
        </svg>
      ),
      color: 'var(--color-success-500)',
    },
    date: {
      icon: (
        <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
          <path d="M4 0v2H2v12h12V2h-2V0h-2v2H6V0H4zm8 6v8H4V6h8z" />
        </svg>
      ),
      color: 'var(--color-primary-500)',
    },
    boolean: {
      icon: (
        <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
          <path d="M3 3h10v10H3V3zm2 2v6h6V5H5z" />
        </svg>
      ),
      color: 'var(--color-warning-500)',
    },
    reference: {
      icon: (
        <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
          <path d="M4 4h4v2H4v4h2v2H2V4h2zm6 6h4v2h-4v-2zm0-6h4v2h-4V4z" />
        </svg>
      ),
      color: 'var(--color-primary-500)',
    },
    user: {
      icon: (
        <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="8" cy="4" r="3" />
          <path d="M2 14c0-3.31 2.69-6 6-6s6 2.69 6 6H2z" />
        </svg>
      ),
      color: 'var(--color-accent-500)',
    },
    status: {
      icon: (
        <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="8" cy="8" r="6" />
        </svg>
      ),
      color: 'var(--color-info-500)',
    },
  };

  return config[type] || config.text;
};

// =============================================================================
// ICONS
// =============================================================================

const ChevronUpIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M4 10L8 6L12 10" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const EyeIcon = () => (
  <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
    <path d="M8 3C4.36 3 1.26 5.28 0 8.5c1.26 3.22 4.36 5.5 8 5.5s6.74-2.28 8-5.5C14.74 5.28 11.64 3 8 3zm0 9c-1.93 0-3.5-1.57-3.5-3.5S6.07 5 8 5s3.5 1.57 3.5 3.5S9.93 12 8 12zm0-5.5a2 2 0 100 4 2 2 0 000-4z" />
  </svg>
);

const EyeOffIcon = () => (
  <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
    <path d="M13.36 11.36l1.28 1.28-1.28 1.28-.71-.71 1.28-1.28-1.28-1.28.71-.71 1.28 1.28zM2.64 4.64L1.36 3.36l.71-.71 1.28 1.28 1.28-1.28.71.71-1.28 1.28 1.28 1.28-.71.71-1.28-1.28zM8 5c1.93 0 3.5 1.57 3.5 3.5 0 .68-.2 1.31-.53 1.85L8.12 7.5c.53-.04 1.02.35 1.02.88 0 .2-.06.39-.16.55l-2.85-2.85c.24-.05.49-.08.75-.08zM8 12c-1.93 0-3.5-1.57-3.5-3.5 0-.68.2-1.31.53-1.85l2.85 2.85c-.53.04-1.02-.35-1.02-.88 0-.2.06-.39.16-.55l2.85 2.85c-.24.05-.49.08-.75.08z" />
  </svg>
);

const SearchIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="7" cy="7" r="5" />
    <path d="M11 11L14 14" strokeLinecap="round" />
  </svg>
);

const GripIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
    <circle cx="4" cy="4" r="1.5" />
    <circle cx="4" cy="8" r="1.5" />
    <circle cx="4" cy="12" r="1.5" />
    <circle cx="8" cy="4" r="1.5" />
    <circle cx="8" cy="8" r="1.5" />
    <circle cx="8" cy="12" r="1.5" />
  </svg>
);

// =============================================================================
// COLUMN ITEM COMPONENT
// =============================================================================

interface ColumnItemProps {
  column: ColumnInfo;
  onToggle: (id: string) => void;
  enableDrag?: boolean;
}

function ColumnItem({ column, onToggle, enableDrag }: ColumnItemProps) {
  const typeInfo = getColumnTypeInfo(column.type);

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-lg transition-colors',
        'hover:bg-hover',
        !column.isVisible && 'opacity-60'
      )}
    >
      {enableDrag && (
        <span className="text-muted-foreground cursor-grab">
          <GripIcon />
        </span>
      )}

      {/* Type icon */}
      <span style={{ color: typeInfo.color }}>{typeInfo.icon}</span>

      {/* Label */}
      <span className="flex-1 text-sm text-foreground">
        {column.label}
      </span>

      {/* Visibility toggle */}
      <button
        onClick={() => onToggle(column.id)}
        className={cn(
          'p-1.5 rounded-lg transition-colors',
          column.isVisible
            ? 'bg-primary/10 text-primary'
            : 'bg-muted text-muted-foreground hover:text-foreground'
        )}
        title={column.isVisible ? 'Hide column' : 'Show column'}
      >
        {column.isVisible ? <EyeIcon /> : <EyeOffIcon />}
      </button>
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function InlineColumnPanel<TData extends GridRowData>({
  table,
  isOpen,
  onClose,
  onColumnOrderChange,
}: InlineColumnPanelProps<TData>) {
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Focus search input when panel opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Get all columns with visibility info
  const allColumns = useMemo<ColumnInfo[]>(() => {
    return table
      .getAllColumns()
      .filter((col) => {
        const id = col.id;
        // Exclude system columns
        return id !== 'select' && id !== '_actions' && id !== '_view';
      })
      .map((col) => {
        const columnDef = col.columnDef;
        return {
          id: col.id,
          label: typeof columnDef.header === 'string' ? columnDef.header : col.id,
          type: (columnDef.meta as { type?: GridColumnType })?.type || 'text',
          isVisible: col.getIsVisible(),
        };
      });
  }, [table]);

  // Filter columns by search query
  const filteredColumns = useMemo(() => {
    if (!searchQuery) return allColumns;
    const query = searchQuery.toLowerCase();
    return allColumns.filter(
      (col) =>
        col.label.toLowerCase().includes(query) || col.id.toLowerCase().includes(query)
    );
  }, [allColumns, searchQuery]);

  // Counts
  const visibleCount = allColumns.filter((c) => c.isVisible).length;
  const totalCount = allColumns.length;

  // Toggle column visibility
  const handleToggleColumn = useCallback(
    (columnId: string) => {
      const column = table.getColumn(columnId);
      if (column) {
        column.toggleVisibility();
      }
    },
    [table]
  );

  // Show all columns
  const handleShowAll = useCallback(() => {
    table.getAllColumns().forEach((col) => {
      if (col.id !== 'select' && col.id !== '_actions' && col.id !== '_view') {
        col.toggleVisibility(true);
      }
    });
  }, [table]);

  // Hide all columns
  const handleHideAll = useCallback(() => {
    table.getAllColumns().forEach((col) => {
      if (col.id !== 'select' && col.id !== '_actions' && col.id !== '_view') {
        col.toggleVisibility(false);
      }
    });
  }, [table]);

  // Handle column reorder
  const handleReorder = useCallback(
    (fromIndex: number, toIndex: number) => {
      const visibleColumns = allColumns.filter((col) => col.isVisible);
      const newVisibleOrder = [...visibleColumns.map((c) => c.id)];
      const [removed] = newVisibleOrder.splice(fromIndex, 1);
      newVisibleOrder.splice(toIndex, 0, removed);

      const hiddenColumns = allColumns.filter((col) => !col.isVisible).map((c) => c.id);
      const newOrder = [...newVisibleOrder, ...hiddenColumns];

      table.setColumnOrder(newOrder);
      onColumnOrderChange?.(newOrder);
    },
    [allColumns, table, onColumnOrderChange]
  );
  void handleReorder; // Reserved for drag-and-drop implementation

  if (!isOpen) return null;

  return (
    <div
      className="absolute left-0 right-0 z-30 border-b border-border bg-card shadow-lg overflow-hidden transition-all duration-200"
      style={{ top: 0 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border">
        <div className="flex items-center gap-3">
          <svg
            className="w-4 h-4 text-primary"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <rect x="1" y="1" width="5" height="14" rx="1" />
            <rect x="8" y="1" width="7" height="14" rx="1" />
          </svg>
          <span className="text-sm font-medium text-foreground">
            Column Visibility
          </span>
          <span
            className="px-2 py-0.5 rounded-full text-xs bg-primary/10 text-primary"
          >
            {visibleCount} of {totalCount}
          </span>
        </div>

        <button
          onClick={onClose}
          className="btn-ghost btn-icon btn-sm"
          title="Collapse column panel"
        >
          <ChevronUpIcon />
        </button>
      </div>

      {/* Search and quick actions */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-border">
        {/* Search */}
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg flex-1 bg-muted border border-border"
        >
          <span className="text-muted-foreground">
            <SearchIcon />
          </span>
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search columns..."
            className="flex-1 bg-transparent outline-none text-sm text-foreground placeholder:text-muted-foreground"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="p-0.5 rounded transition-colors text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M2 2L10 10M10 2L2 10" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>

        {/* Quick actions */}
        <button
          onClick={handleShowAll}
          className="btn-secondary btn-xs"
        >
          <EyeIcon />
          Show All
        </button>
        <button
          onClick={handleHideAll}
          className="btn-secondary btn-xs"
        >
          <EyeOffIcon />
          Hide All
        </button>
      </div>

      {/* Column list */}
      <div className="px-2 py-2 max-h-[300px] overflow-y-auto">
        {filteredColumns.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <span className="text-muted-foreground">
              <SearchIcon />
            </span>
            <p className="text-sm mt-2 text-muted-foreground">
              No columns found
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-1">
            {filteredColumns.map((column) => (
              <ColumnItem
                key={column.id}
                column={column}
                onToggle={handleToggleColumn}
                enableDrag={false}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-border bg-muted">
        {/* Progress bar */}
        <div className="flex items-center gap-2">
          <div className="w-20 h-1.5 rounded-full overflow-hidden bg-border">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${totalCount > 0 ? (visibleCount / totalCount) * 100 : 0}%`,
                backgroundColor: 'var(--bg-primary)',
              }}
            />
          </div>
          <span className="text-xs text-muted-foreground">
            {totalCount > 0 ? Math.round((visibleCount / totalCount) * 100) : 0}% visible
          </span>
        </div>

        <button
          onClick={onClose}
          className="btn-primary btn-xs"
        >
          Done
        </button>
      </div>
    </div>
  );
}

export default InlineColumnPanel;
