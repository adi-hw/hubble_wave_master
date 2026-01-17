/**
 * GridToolbar - Toolbar component for HubbleDataGrid
 *
 * Features:
 * - Global search with AVA enhancement
 * - Filter bar with chips
 * - Group by selector
 * - View selector
 * - Export and refresh actions
 * - Column chooser
 */

import React, { memo, useCallback, useState, useRef } from 'react';
import { Table } from '@tanstack/react-table';
import { cn } from '../utils/cn';
import type { GridRowData, AvaSuggestion } from '../types';

// =============================================================================
// SEARCH INPUT
// =============================================================================

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  onEnter?: () => void;
  suggestions?: AvaSuggestion[];
}

const SearchInput = memo(function SearchInput({
  value,
  onChange,
  placeholder = 'Search...',
  onEnter,
  suggestions: _suggestions = [],
}: SearchInputProps) {
  // _suggestions available for future AVA autocomplete implementation
  const [isFocused, setIsFocused] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        onEnter?.();
      }
      if (e.key === 'Escape') {
        setIsExpanded(false);
        inputRef.current?.blur();
      }
    },
    [onEnter]
  );

  const handleIconClick = useCallback(() => {
    setIsExpanded(true);
    // Focus input after expansion animation
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
    // Collapse only if there's no value
    if (!value) {
      setIsExpanded(false);
    }
  }, [value]);

  // Keep expanded if there's a value
  const showExpanded = isExpanded || !!value;

  return (
    <div className="relative">
      {showExpanded ? (
        <div
          className={cn(
            'flex items-center gap-2 px-3 py-2 rounded-lg border transition-all duration-200',
            'bg-card',
            isFocused ? 'border-primary ring-2 ring-primary/20' : 'border-border'
          )}
        >
          <svg
            className="w-4 h-4 flex-shrink-0 text-muted-foreground"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="7" cy="7" r="5" />
            <path d="M11 11L14 14" />
          </svg>

          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={handleBlur}
            placeholder={placeholder}
            className="flex-1 bg-transparent outline-none min-w-[200px] text-sm text-foreground placeholder:text-muted-foreground"
            aria-label="Search grid"
          />

          {value && (
            <button
              onClick={() => onChange('')}
              className="p-0.5 rounded transition-colors flex-shrink-0 text-muted-foreground hover:text-foreground hover:bg-muted"
              aria-label="Clear search"
            >
              <svg className="w-3 h-3" viewBox="0 0 12 12" fill="currentColor">
                <path d="M3 3L9 9M9 3L3 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>
      ) : (
        <button
          onClick={handleIconClick}
          className="btn-ghost btn-icon btn-sm"
          title="Search"
          aria-label="Open search"
        >
          <svg
            className="w-4 h-4"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="7" cy="7" r="5" />
            <path d="M11 11L14 14" />
          </svg>
        </button>
      )}
    </div>
  );
});

// =============================================================================
// TOOLBAR BUTTON
// =============================================================================

interface ToolbarButtonProps {
  icon: React.ReactNode;
  label?: string;
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
  title?: string;
}

const ToolbarButton = memo(function ToolbarButton({
  icon,
  label,
  onClick,
  active,
  disabled,
  title,
}: ToolbarButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors border',
        active
          ? 'bg-primary/10 text-primary border-primary/30'
          : 'bg-transparent text-muted-foreground border-transparent hover:bg-muted hover:text-foreground',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
    >
      {icon}
      {label && <span>{label}</span>}
    </button>
  );
});

// =============================================================================
// FILTER CHIP
// =============================================================================

interface FilterChipProps {
  label: string;
  value: string;
  onRemove: () => void;
}

const FilterChip = memo(function FilterChip({ label, value, onRemove }: FilterChipProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-1.5 px-2 py-1 rounded-lg',
        'bg-primary/10 border border-primary/20',
        'text-xs text-primary'
      )}
    >
      <span className="font-medium">{label}:</span>
      <span>{value}</span>
      <button
        onClick={onRemove}
        className="ml-1 p-0.5 rounded hover:bg-primary/20 transition-colors"
        aria-label={`Remove ${label} filter`}
      >
        <svg className="w-3 h-3" viewBox="0 0 12 12" fill="currentColor">
          <path d="M3 3L9 9M9 3L3 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
});

// =============================================================================
// TOOLBAR ICONS
// =============================================================================

const FilterIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
    <path d="M1 2H15L9 8.5V13L7 14V8.5L1 2Z" />
  </svg>
);

const ColumnsIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="1" y="1" width="5" height="14" rx="1" />
    <rect x="8" y="1" width="7" height="14" rx="1" />
  </svg>
);

const ExportIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M8 2V10M8 2L5 5M8 2L11 5" />
    <path d="M2 10V13C2 13.5523 2.44772 14 3 14H13C13.5523 14 14 13.5523 14 13V10" />
  </svg>
);

// =============================================================================
// FILTER PANEL NOTES
// =============================================================================

// AdvancedFilterBuilder provides:
// - Dynamic operators based on field types
// - Filter groups with AND/OR/XOR/NAND/NOR logic
// - Nested filter groups for complex conditions
// - Quick filter presets
// - Visual filter tree representation

// =============================================================================
// GRID TOOLBAR COMPONENT
// =============================================================================

interface GridToolbarProps<TData extends GridRowData> {
  table: Table<TData>;
  globalFilter: string;
  onGlobalFilterChange: (value: string) => void;
  enableSearch?: boolean;
  enableFiltering?: boolean;
  enableExport?: boolean;
  viewId?: string;
  onViewChange?: (viewId: string | null) => void;
  onRefresh?: () => void;
  onExport?: (format: 'csv' | 'xlsx' | 'pdf') => void;
  avaSuggestions?: AvaSuggestion[];
  className?: string;
  columns?: Array<{ code: string; label: string; groupable?: boolean }>;
  /** Title displayed on the right side of the toolbar (e.g., table name) */
  title?: string;
  /** Callback for add button - if provided, shows add button */
  onAdd?: () => void;
  /** Custom action buttons to display */
  customActions?: React.ReactNode;
  /** Whether the filter panel is open (controlled mode for inline panels) */
  showFilters?: boolean;
  /** Callback when filter panel toggle is clicked */
  onShowFiltersChange?: (show: boolean) => void;
  /** Whether the column panel is open (controlled mode for inline panels) */
  showColumns?: boolean;
  /** Callback when column panel toggle is clicked */
  onShowColumnsChange?: (show: boolean) => void;
}

export const GridToolbar = memo(function GridToolbar<TData extends GridRowData>({
  table,
  globalFilter,
  onGlobalFilterChange,
  enableSearch = true,
  enableFiltering = true,
  enableExport = true,
  viewId: _viewId,
  onViewChange: _onViewChange,
  onRefresh: _onRefresh,
  onExport,
  avaSuggestions = [],
  className,
  columns = [],
  title,
  onAdd,
  customActions,
  showFilters: controlledShowFilters,
  onShowFiltersChange,
  showColumns: controlledShowColumns,
  onShowColumnsChange,
}: GridToolbarProps<TData>) {
  // _viewId and _onViewChange available for future view system implementation
  // columns prop available for future column-based features
  void columns;

  // Use controlled state if provided, otherwise use internal state
  const [internalShowFilters, setInternalShowFilters] = useState(false);
  const [internalShowColumns, setInternalShowColumns] = useState(false);
  const [_showExport, _setShowExport] = useState(false);
  // _showExport/_setShowExport available for export dropdown menu

  // Determine whether to use controlled or uncontrolled mode
  const isFilterControlled = controlledShowFilters !== undefined && onShowFiltersChange !== undefined;
  const isColumnControlled = controlledShowColumns !== undefined && onShowColumnsChange !== undefined;

  const showFilters = isFilterControlled ? controlledShowFilters : internalShowFilters;
  const showColumns = isColumnControlled ? controlledShowColumns : internalShowColumns;

  const handleShowFiltersChange = useCallback((show: boolean) => {
    if (isFilterControlled) {
      onShowFiltersChange?.(show);
    } else {
      setInternalShowFilters(show);
    }
  }, [isFilterControlled, onShowFiltersChange]);

  const handleShowColumnsChange = useCallback((show: boolean) => {
    if (isColumnControlled) {
      onShowColumnsChange?.(show);
    } else {
      setInternalShowColumns(show);
    }
  }, [isColumnControlled, onShowColumnsChange]);

  const columnFilters = table.getState().columnFilters;

  const handleClearFilter = useCallback(
    (filterId: string) => {
      table.setColumnFilters((prev) => prev.filter((f) => f.id !== filterId));
    },
    [table]
  );

  const handleClearAllFilters = useCallback(() => {
    table.resetColumnFilters();
  }, [table]);

  return (
    <div
      className={cn(
        'flex flex-col gap-2 px-4 py-3 border-b',
        'bg-card border-border',
        className
      )}
      style={{
        minHeight: 'var(--grid-toolbar-height)',
        flexShrink: 0,
      }}
    >
      {/* Main toolbar row */}
      <div className="flex items-center gap-3">
        {/* Title on far left */}
        {title && (
          <span
            className="text-sm font-medium whitespace-nowrap"
            style={{ color: 'var(--text-primary)' }}
          >
            {title}
          </span>
        )}

        {/* Filter button (after title) */}
        {enableFiltering && (
          <ToolbarButton
            icon={<FilterIcon />}
            onClick={() => handleShowFiltersChange(!showFilters)}
            active={showFilters || columnFilters.length > 0}
            title="Advanced Filters"
          />
        )}

        {/* Search (after filter) */}
        {enableSearch && (
          <SearchInput
            value={globalFilter}
            onChange={onGlobalFilterChange}
            placeholder="Search or ask AVA..."
            suggestions={avaSuggestions}
          />
        )}

        <div className="flex-1" />

        {/* Actions on right */}
        <div className="flex items-center gap-1">
          {/* Column picker toggle */}
          <ToolbarButton
            icon={<ColumnsIcon />}
            onClick={() => handleShowColumnsChange(!showColumns)}
            active={showColumns}
            title="Show/hide columns"
          />

          {enableExport && (
            <ToolbarButton
              icon={<ExportIcon />}
              onClick={() => onExport?.('csv')}
              title="Export data"
            />
          )}

          {/* Custom actions */}
          {customActions}

          {/* Add button */}
          {onAdd && (
            <button
              onClick={onAdd}
              className="btn-primary btn-icon btn-sm"
              title="Add new"
              aria-label="Add new"
            >
              <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M8 3V13M3 8H13" strokeLinecap="round" />
              </svg>
            </button>
          )}

        </div>
      </div>

      {/* Active filters row */}
      {columnFilters.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-[var(--grid-cell-muted-color)]">Filters:</span>
          {columnFilters.map((filter) => {
            const column = table.getColumn(filter.id);
            const header = column?.columnDef.header;
            const label = typeof header === 'string' ? header : filter.id;
            const value = String(filter.value);

            return (
              <FilterChip
                key={filter.id}
                label={label}
                value={value}
                onRemove={() => handleClearFilter(filter.id)}
              />
            );
          })}
          <button
            onClick={handleClearAllFilters}
            className="text-xs text-[var(--grid-cell-muted-color)] hover:text-[var(--grid-cell-color)] transition-colors"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}) as <TData extends GridRowData>(props: GridToolbarProps<TData>) => React.ReactElement;
