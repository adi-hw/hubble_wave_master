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
  const inputRef = useRef<HTMLInputElement>(null);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        onEnter?.();
      }
    },
    [onEnter]
  );

  return (
    <div className="relative">
      <div
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-lg',
          'bg-[var(--glass-bg)] border border-[var(--glass-border)]',
          'transition-all duration-200',
          isFocused && 'border-[var(--primary-500)] ring-2 ring-[var(--primary-500)]/20'
        )}
      >
        <svg
          className="w-4 h-4 text-[var(--grid-cell-muted-color)]"
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
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          className={cn(
            'flex-1 bg-transparent outline-none min-w-[200px]',
            'text-sm text-[var(--grid-cell-color)]',
            'placeholder:text-[var(--grid-cell-muted-color)]'
          )}
          aria-label="Search grid"
        />

        {value && (
          <button
            onClick={() => onChange('')}
            className="p-0.5 rounded hover:bg-[var(--glass-bg-hover)] transition-colors"
            aria-label="Clear search"
          >
            <svg className="w-3 h-3 text-[var(--grid-cell-muted-color)]" viewBox="0 0 12 12" fill="currentColor">
              <path d="M3 3L9 9M9 3L3 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </div>
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
        'flex items-center gap-2 px-3 py-2 rounded-lg',
        'text-sm font-medium transition-colors',
        'border border-transparent',
        active
          ? 'bg-[var(--primary-500)]/10 text-[var(--primary-400)] border-[var(--primary-500)]/20'
          : 'text-[var(--grid-cell-color)] hover:bg-[var(--glass-bg-hover)]',
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
        'bg-[var(--primary-500)]/10 border border-[var(--primary-500)]/20',
        'text-xs text-[var(--primary-400)]'
      )}
    >
      <span className="font-medium">{label}:</span>
      <span>{value}</span>
      <button
        onClick={onRemove}
        className="ml-1 p-0.5 rounded hover:bg-[var(--primary-500)]/20 transition-colors"
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

const GroupIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="1" y="2" width="14" height="4" rx="1" />
    <rect x="3" y="8" width="12" height="3" rx="1" />
    <rect x="3" y="12" width="12" height="3" rx="1" />
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

const RefreshIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M2 8C2 4.68629 4.68629 2 8 2C10.3304 2 12.3445 3.36474 13.2891 5.33333" />
    <path d="M14 8C14 11.3137 11.3137 14 8 14C5.66963 14 3.65551 12.6353 2.71094 10.6667" />
    <path d="M14 2V5.33333H10.6667" />
    <path d="M2 14V10.6667H5.33333" />
  </svg>
);

const MoreIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
    <circle cx="8" cy="3" r="1.5" />
    <circle cx="8" cy="8" r="1.5" />
    <circle cx="8" cy="13" r="1.5" />
  </svg>
);

// =============================================================================
// GRID TOOLBAR COMPONENT
// =============================================================================

interface GridToolbarProps<TData extends GridRowData> {
  table: Table<TData>;
  globalFilter: string;
  onGlobalFilterChange: (value: string) => void;
  enableSearch?: boolean;
  enableFiltering?: boolean;
  enableGrouping?: boolean;
  enableExport?: boolean;
  viewId?: string;
  onViewChange?: (viewId: string | null) => void;
  onRefresh?: () => void;
  onExport?: (format: 'csv' | 'xlsx' | 'pdf') => void;
  avaSuggestions?: AvaSuggestion[];
  className?: string;
}

export const GridToolbar = memo(function GridToolbar<TData extends GridRowData>({
  table,
  globalFilter,
  onGlobalFilterChange,
  enableSearch = true,
  enableFiltering = true,
  enableGrouping = true,
  enableExport = true,
  viewId: _viewId,
  onViewChange: _onViewChange,
  onRefresh,
  onExport,
  avaSuggestions = [],
  className,
}: GridToolbarProps<TData>) {
  // _viewId and _onViewChange available for future view system implementation
  const [showFilters, setShowFilters] = useState(false);
  const [showColumns, setShowColumns] = useState(false);
  const [_showExport, _setShowExport] = useState(false);
  // _showExport/_setShowExport available for export dropdown menu

  const columnFilters = table.getState().columnFilters;
  const grouping = table.getState().grouping;

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
        'flex flex-col gap-2 px-4 py-3',
        'bg-[var(--grid-toolbar-bg)]',
        'border-b border-[var(--grid-border)]',
        className
      )}
      style={{ minHeight: 'var(--grid-toolbar-height)' }}
    >
      {/* Main toolbar row */}
      <div className="flex items-center gap-3">
        {/* Search */}
        {enableSearch && (
          <SearchInput
            value={globalFilter}
            onChange={onGlobalFilterChange}
            placeholder="Search or ask AVA..."
            suggestions={avaSuggestions}
          />
        )}

        <div className="flex-1" />

        {/* Actions */}
        <div className="flex items-center gap-1">
          {enableFiltering && (
            <ToolbarButton
              icon={<FilterIcon />}
              label="Filters"
              onClick={() => setShowFilters(!showFilters)}
              active={showFilters || columnFilters.length > 0}
              title="Toggle filters"
            />
          )}

          {enableGrouping && (
            <ToolbarButton
              icon={<GroupIcon />}
              label="Group"
              onClick={() => {}}
              active={grouping.length > 0}
              title="Group by column"
            />
          )}

          <ToolbarButton
            icon={<ColumnsIcon />}
            onClick={() => setShowColumns(!showColumns)}
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

          <ToolbarButton
            icon={<RefreshIcon />}
            onClick={onRefresh}
            title="Refresh data"
          />

          <ToolbarButton
            icon={<MoreIcon />}
            title="More options"
          />
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
