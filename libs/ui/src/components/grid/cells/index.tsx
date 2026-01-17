/**
 * Cell Renderers - Type-specific cell components for HubbleDataGrid
 *
 * Each renderer is optimized for a specific data type with appropriate
 * formatting, styling, and interaction handling.
 *
 * Design: Futuristic 2070-era glassmorphic aesthetic with visual differentiation
 */

import React, { memo, useState, useRef, useEffect } from 'react';
import { cn } from '../utils/cn';
import type { CellRendererProps, GridRowData, GridColumnType } from '../types';

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

function formatNumber(value: number, locale = 'en-US'): string {
  return new Intl.NumberFormat(locale).format(value);
}

function formatCurrency(value: number, currency = 'USD', locale = 'en-US'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(value);
}

function formatPercent(value: number, locale = 'en-US'): string {
  return new Intl.NumberFormat(locale, {
    style: 'percent',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: string | Date, _format?: string): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  if (isNaN(date.getTime())) return '-';

  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

function formatDateTime(value: string | Date, _format?: string): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  if (isNaN(date.getTime())) return '-';

  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function formatTime(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  if (isNaN(date.getTime())) return '-';

  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  }).format(date);
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours < 24) return `${hours}h ${mins}m`;
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return `${days}d ${remainingHours}h`;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// Generate consistent color from string (for avatars, tags)
function stringToColor(str: string): string {
  const colors = [
    'var(--color-primary-500)',
    'var(--color-accent-500)',
    'var(--color-info-500)',
    'var(--color-success-500)',
    'var(--color-warning-500)',
    'var(--color-danger-500)',
    'var(--color-primary-400)',
    'var(--color-accent-400)',
    'var(--color-info-400)',
    'var(--color-success-400)',
  ];
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

// =============================================================================
// TEXT CELL
// =============================================================================

export const TextCell = memo(function TextCell<TData extends GridRowData>({
  value,
  column: _column,
}: CellRendererProps<TData>) {
  void _column;
  const displayValue = value != null ? String(value) : '-';

  return (
    <span
      className="truncate text-[var(--grid-cell-color)]"
      title={displayValue !== '-' ? displayValue : undefined}
    >
      {displayValue}
    </span>
  );
});

// =============================================================================
// NUMBER CELL
// =============================================================================

export const NumberCell = memo(function NumberCell<TData extends GridRowData>({
  value,
  column: _column,
}: CellRendererProps<TData>) {
  void _column;
  if (value == null || value === '') return <span className="text-[var(--grid-cell-muted-color)]">-</span>;

  const numValue = typeof value === 'number' ? value : parseFloat(String(value));
  if (isNaN(numValue)) return <span className="text-[var(--grid-cell-muted-color)]">-</span>;

  return (
    <span className="font-mono text-[var(--grid-cell-color)] tabular-nums">
      {formatNumber(numValue)}
    </span>
  );
});

// =============================================================================
// CURRENCY CELL - Enhanced with symbol highlighting
// =============================================================================

export const CurrencyCell = memo(function CurrencyCell<TData extends GridRowData>({
  value,
  column,
}: CellRendererProps<TData>) {
  if (value == null || value === '') return <span className="text-[var(--grid-cell-muted-color)]">-</span>;

  const numValue = typeof value === 'number' ? value : parseFloat(String(value));
  if (isNaN(numValue)) return <span className="text-[var(--grid-cell-muted-color)]">-</span>;

  const currency = column.format?.split(':')[1] || 'USD';
  const formatted = formatCurrency(numValue, currency);

  // Extract symbol and value
  const match = formatted.match(/^([^\d\s]+)?\s*([\d,.-]+)\s*([^\d\s]+)?$/);
  const prefix = match?.[1] || '';
  const amount = match?.[2] || formatted;
  const suffix = match?.[3] || '';

  return (
    <span className="inline-flex items-center gap-0.5 font-mono tabular-nums">
      {prefix && (
        <span className="text-[var(--status-completed)] font-semibold">{prefix}</span>
      )}
      <span className="text-[var(--grid-cell-color)]">{amount}</span>
      {suffix && (
        <span className="text-[var(--status-completed)] font-semibold">{suffix}</span>
      )}
    </span>
  );
});

// =============================================================================
// PERCENT CELL
// =============================================================================

export const PercentCell = memo(function PercentCell<TData extends GridRowData>({
  value,
  column: _column,
}: CellRendererProps<TData>) {
  void _column;
  if (value == null || value === '') return <span className="text-[var(--grid-cell-muted-color)]">-</span>;

  const numValue = typeof value === 'number' ? value : parseFloat(String(value));
  if (isNaN(numValue)) return <span className="text-[var(--grid-cell-muted-color)]">-</span>;

  return (
    <span className="font-mono text-[var(--grid-cell-color)] tabular-nums">
      {formatPercent(numValue / 100)}
    </span>
  );
});

// =============================================================================
// DATE CELL - Enhanced with calendar icon
// =============================================================================

export const DateCell = memo(function DateCell<TData extends GridRowData>({
  value,
  column,
}: CellRendererProps<TData>) {
  if (value == null || value === '') return <span className="text-[var(--grid-cell-muted-color)]">-</span>;

  return (
    <span className="inline-flex items-center gap-2 text-[var(--grid-cell-color)]">
      <svg
        className="w-4 h-4 text-[var(--grid-cell-muted-color)] flex-shrink-0"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <rect x="2" y="3" width="12" height="11" rx="2" />
        <path d="M2 6h12" />
        <path d="M5 1v3M11 1v3" />
      </svg>
      <span>{formatDate(value as string | Date, column.format)}</span>
    </span>
  );
});

// =============================================================================
// DATETIME CELL
// =============================================================================

export const DateTimeCell = memo(function DateTimeCell<TData extends GridRowData>({
  value,
  column,
}: CellRendererProps<TData>) {
  if (value == null || value === '') return <span className="text-[var(--grid-cell-muted-color)]">-</span>;

  return (
    <span className="inline-flex items-center gap-2 text-[var(--grid-cell-color)]">
      <svg
        className="w-4 h-4 text-[var(--grid-cell-muted-color)] flex-shrink-0"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <rect x="2" y="3" width="12" height="11" rx="2" />
        <path d="M2 6h12" />
        <path d="M5 1v3M11 1v3" />
      </svg>
      <span>{formatDateTime(value as string | Date, column.format)}</span>
    </span>
  );
});

// =============================================================================
// TIME CELL
// =============================================================================

export const TimeCell = memo(function TimeCell<TData extends GridRowData>({
  value,
  column: _column,
}: CellRendererProps<TData>) {
  void _column;
  if (value == null || value === '') return <span className="text-[var(--grid-cell-muted-color)]">-</span>;

  return (
    <span className="font-mono text-[var(--grid-cell-color)]">
      {formatTime(value as string | Date)}
    </span>
  );
});

// =============================================================================
// DURATION CELL
// =============================================================================

export const DurationCell = memo(function DurationCell<TData extends GridRowData>({
  value,
  column: _column,
}: CellRendererProps<TData>) {
  void _column;
  if (value == null || value === '') return <span className="text-[var(--grid-cell-muted-color)]">-</span>;

  const minutes = typeof value === 'number' ? value : parseInt(String(value), 10);
  if (isNaN(minutes)) return <span className="text-[var(--grid-cell-muted-color)]">-</span>;

  return (
    <span className="font-mono text-[var(--grid-cell-color)]">{formatDuration(minutes)}</span>
  );
});

// =============================================================================
// BOOLEAN CELL - Enhanced toggle style
// =============================================================================

export const BooleanCell = memo(function BooleanCell<TData extends GridRowData>({
  value,
  column: _column,
}: CellRendererProps<TData>) {
  void _column;
  const isTrue = value === true || value === 'true' || value === 1;
  const isFalse = value === false || value === 'false' || value === 0;

  if (!isTrue && !isFalse) {
    return <span className="text-[var(--grid-cell-muted-color)]">-</span>;
  }

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center w-5 h-5 rounded',
        isTrue
          ? 'bg-[var(--status-completed)] text-white'
          : 'bg-[var(--glass-bg)] text-[var(--grid-cell-muted-color)]'
      )}
    >
      {isTrue ? (
        <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none">
          <path
            d="M10 3L4.5 8.5L2 6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none">
          <path
            d="M3 3L9 9M9 3L3 9"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      )}
    </span>
  );
});

// =============================================================================
// STATUS CELL - Enhanced with dropdown chevron and modern badge
// =============================================================================

export const StatusCell = memo(function StatusCell<TData extends GridRowData>({
  value,
  column,
}: CellRendererProps<TData>) {
  if (value == null || value === '') return <span className="text-[var(--grid-cell-muted-color)]">-</span>;

  const stringValue = String(value);
  const option = column.options?.find(
    (opt) => opt.value === stringValue || opt.label.toLowerCase() === stringValue.toLowerCase()
  );

  const label = option?.label ?? stringValue;
  const color = option?.color ?? 'var(--status-open)';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium',
        'cursor-default select-none transition-all duration-150',
        'border border-transparent hover:border-current/20'
      )}
      style={{
        backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)`,
        color: color,
      }}
    >
      {label}
      <svg
        className="w-3 h-3 opacity-60"
        viewBox="0 0 12 12"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M3 4.5L6 7.5L9 4.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
});

// =============================================================================
// PRIORITY CELL - Enhanced with visual indicator bar
// =============================================================================

const PRIORITY_COLORS: Record<string, string> = {
  critical: 'var(--priority-critical)',
  high: 'var(--priority-high)',
  medium: 'var(--priority-medium)',
  low: 'var(--priority-low)',
  none: 'var(--priority-none)',
};

export const PriorityCell = memo(function PriorityCell<TData extends GridRowData>({
  value,
  column,
}: CellRendererProps<TData>) {
  if (value == null || value === '') return <span className="text-[var(--grid-cell-muted-color)]">-</span>;

  const stringValue = String(value).toLowerCase();
  const option = column.options?.find(
    (opt) => opt.value.toLowerCase() === stringValue || opt.label.toLowerCase() === stringValue
  );

  const label = option?.label ?? String(value);
  const color = option?.color ?? PRIORITY_COLORS[stringValue] ?? 'var(--priority-none)';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide'
      )}
      style={{ color }}
    >
      {/* Priority bar indicator */}
      <span
        className="w-1 h-4 rounded-full"
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  );
});

// =============================================================================
// USER CELL - Enhanced with colored avatar and better layout
// =============================================================================

export const UserCell = memo(function UserCell<TData extends GridRowData>({
  value,
  column: _column,
  row: _row,
}: CellRendererProps<TData>) {
  void _column;
  void _row;
  if (value == null || value === '') return <span className="text-[var(--grid-cell-muted-color)]">-</span>;

  // Value can be a string (name) or an object with name/email/avatar
  const user = typeof value === 'object' && value !== null
    ? (value as { name?: string; email?: string; avatar?: string })
    : { name: String(value) };

  const name = user.name || 'Unknown';
  const initials = getInitials(name);
  const avatarColor = stringToColor(name);

  return (
    <div className="flex items-center gap-2.5">
      {user.avatar ? (
        <img
          src={user.avatar}
          alt={name}
          className="w-7 h-7 rounded-full object-cover ring-2 ring-white/10"
        />
      ) : (
        <div
          className={cn(
            'w-7 h-7 rounded-full flex items-center justify-center',
            'text-white text-xs font-semibold ring-2 ring-white/10'
          )}
          style={{ backgroundColor: avatarColor }}
        >
          {initials}
        </div>
      )}
      <span className="truncate text-[var(--grid-cell-color)] font-medium">{name}</span>
    </div>
  );
});

// =============================================================================
// REFERENCE CELL
// =============================================================================

export const ReferenceCell = memo(function ReferenceCell<TData extends GridRowData>({
  value,
  column,
  row,
  onReferenceClick,
}: CellRendererProps<TData>) {
  if (value == null || value === '') return <span className="text-[var(--grid-cell-muted-color)]">-</span>;

  // Get the referenced collection from column config
  const referenceCollection = column.reference?.collection;

  // The value is the record ID (UUID)
  const recordId = typeof value === 'object' && value !== null
    ? (value as { id?: string }).id || String(value)
    : String(value);

  // Look for display value in the row data using the _display suffix convention
  // Backend sends: { fieldname: "uuid", fieldname_display: "Display Name" }
  const displayKey = `${column.code}_display`;
  const rowData = row as Record<string, unknown>;
  let displayValue = rowData[displayKey] as string | undefined;

  // Fallback: if value is an object with display property
  if (!displayValue && typeof value === 'object' && value !== null) {
    displayValue = (value as { display?: string }).display;
  }

  // Fallback: if no display value found, show the ID (truncated for UUIDs)
  if (!displayValue) {
    // Check if it looks like a UUID, show first 8 chars
    if (recordId && /^[a-f0-9-]{36}$/i.test(recordId)) {
      displayValue = recordId.substring(0, 8) + '...';
    } else {
      displayValue = recordId || '-';
    }
  }

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent row click
    if (onReferenceClick && referenceCollection && recordId) {
      onReferenceClick({
        collection: referenceCollection,
        recordId,
        columnCode: column.code,
        displayValue: displayValue || '-',
        row,
      });
    }
  };

  const isClickable = !!onReferenceClick && !!referenceCollection && !!recordId;

  return (
    <span
      className={cn(
        'truncate',
        isClickable
          ? 'text-[var(--primary-400)] hover:text-[var(--primary-300)] cursor-pointer hover:underline'
          : 'text-[var(--grid-cell-color)]'
      )}
      title={displayValue}
      onClick={isClickable ? handleClick : undefined}
      role={isClickable ? 'link' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={isClickable ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick(e as unknown as React.MouseEvent);
        }
      } : undefined}
    >
      {displayValue}
    </span>
  );
});

// =============================================================================
// TAGS CELL - Enhanced with colored pills and close buttons
// =============================================================================

export const TagsCell = memo(function TagsCell<TData extends GridRowData>({
  value,
  column: _column,
}: CellRendererProps<TData>) {
  void _column;
  if (value == null || (Array.isArray(value) && value.length === 0)) {
    return <span className="text-[var(--grid-cell-muted-color)]">-</span>;
  }

  const tags = Array.isArray(value)
    ? value
    : typeof value === 'string'
    ? value.split(',').map((t) => t.trim())
    : [String(value)];

  const displayTags = tags.slice(0, 3);
  const remainingCount = tags.length - 3;

  return (
    <div className="flex items-center gap-1.5 overflow-hidden">
      {displayTags.map((tag, i) => {
        const tagColor = stringToColor(tag);
        return (
          <span
            key={i}
            className={cn(
              'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium',
              'border transition-colors cursor-default'
            )}
            style={{
              backgroundColor: `color-mix(in srgb, ${tagColor} 15%, transparent)`,
              borderColor: `color-mix(in srgb, ${tagColor} 30%, transparent)`,
              color: tagColor,
            }}
          >
            {tag}
            <svg
              className="w-3 h-3 opacity-60 hover:opacity-100 cursor-pointer"
              viewBox="0 0 12 12"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M3 3L9 9M9 3L3 9" strokeLinecap="round" />
            </svg>
          </span>
        );
      })}
      {remainingCount > 0 && (
        <span
          className="inline-flex items-center justify-center px-1.5 py-0.5 rounded text-xs font-medium"
          style={{
            backgroundColor: 'var(--glass-bg)',
            color: 'var(--grid-cell-muted-color)',
          }}
        >
          +{remainingCount}
        </span>
      )}
    </div>
  );
});

// =============================================================================
// PROGRESS CELL - Enhanced with gradient and glow
// =============================================================================

export const ProgressCell = memo(function ProgressCell<TData extends GridRowData>({
  value,
  column: _column,
}: CellRendererProps<TData>) {
  void _column;
  if (value == null || value === '') return <span className="text-[var(--grid-cell-muted-color)]">-</span>;

  const percent = typeof value === 'number' ? value : parseFloat(String(value));
  if (isNaN(percent)) return <span className="text-[var(--grid-cell-muted-color)]">-</span>;

  const clampedPercent = Math.max(0, Math.min(100, percent));

  // Dynamic color based on progress
  const getProgressColor = (p: number) => {
    if (p >= 100) return 'var(--status-completed)';
    if (p >= 75) return 'var(--primary-500)';
    if (p >= 50) return 'var(--priority-medium)';
    return 'var(--priority-high)';
  };

  const progressColor = getProgressColor(clampedPercent);

  return (
    <div className="flex items-center gap-3 w-full">
      <div
        className="flex-1 h-1.5 rounded-full overflow-hidden"
        style={{ backgroundColor: 'var(--glass-bg)' }}
      >
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{
            width: `${clampedPercent}%`,
            backgroundColor: progressColor,
            boxShadow: `0 0 8px ${progressColor}`,
          }}
        />
      </div>
      <span
        className="text-xs font-mono w-10 text-right font-medium"
        style={{ color: progressColor }}
      >
        {Math.round(clampedPercent)}%
      </span>
    </div>
  );
});

// =============================================================================
// IMAGE CELL
// =============================================================================

export const ImageCell = memo(function ImageCell<TData extends GridRowData>({
  value,
  column: _column,
}: CellRendererProps<TData>) {
  void _column;
  if (value == null || value === '') return <span className="text-[var(--grid-cell-muted-color)]">-</span>;

  const src = typeof value === 'string' ? value : (value as { url?: string })?.url;
  if (!src) return <span className="text-[var(--grid-cell-muted-color)]">-</span>;

  return (
    <img
      src={src}
      alt=""
      className="w-8 h-8 rounded object-cover bg-[var(--glass-bg)]"
      loading="lazy"
    />
  );
});

// =============================================================================
// ACTIONS CELL
// =============================================================================

interface ActionItem<TData> {
  id: string;
  label: string;
  icon?: string;
  onClick: (row: TData) => void;
  disabled?: (row: TData) => boolean;
  hidden?: (row: TData) => boolean;
  variant?: 'default' | 'primary' | 'danger';
}

export const ActionsCell = memo(function ActionsCell<TData extends GridRowData>({
  value: _value,
  column,
  row,
}: CellRendererProps<TData>) {
  void _value;
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Get actions from column definition or fallback to empty array
  const actions: ActionItem<TData>[] = column.actions ?? [];

  // Close menu when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Filter out hidden actions
  const visibleActions = actions.filter((action) => !action.hidden?.(row));

  if (visibleActions.length === 0) {
    return null;
  }

  const handleActionClick = (action: ActionItem<TData>, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!action.disabled?.(row)) {
      action.onClick(row);
      setIsOpen(false);
    }
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        className={cn(
          'p-1 rounded hover:bg-[var(--glass-bg-hover)] transition-colors',
          'text-[var(--grid-cell-muted-color)] hover:text-[var(--grid-cell-color)]',
          isOpen && 'bg-[var(--glass-bg-hover)]'
        )}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        aria-label="Row actions"
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="8" cy="3" r="1.5" />
          <circle cx="8" cy="8" r="1.5" />
          <circle cx="8" cy="13" r="1.5" />
        </svg>
      </button>

      {isOpen && (
        <div
          className={cn(
            'absolute right-0 top-full mt-1 z-50',
            'min-w-[140px] py-1 rounded-lg',
            'bg-[var(--glass-bg)] backdrop-blur-sm',
            'border border-[var(--glass-border)]',
            'shadow-lg'
          )}
          role="menu"
        >
          {visibleActions.map((action) => {
            const isDisabled = action.disabled?.(row);
            return (
              <button
                key={action.id}
                onClick={(e) => handleActionClick(action, e)}
                disabled={isDisabled}
                className={cn(
                  'w-full px-3 py-1.5 text-left text-sm',
                  'transition-colors flex items-center gap-2',
                  isDisabled && 'opacity-50 cursor-not-allowed',
                  !isDisabled && 'hover:bg-[var(--glass-bg-hover)]',
                  action.variant === 'danger' && 'text-[var(--priority-critical)]',
                  action.variant === 'primary' && 'text-[var(--primary-400)]',
                  !action.variant && 'text-[var(--grid-cell-color)]'
                )}
                role="menuitem"
              >
                {action.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
});

// =============================================================================
// SELECT CELL - Enhanced select/enum dropdown display
// =============================================================================

export const SelectCell = memo(function SelectCell<TData extends GridRowData>({
  value,
  column,
}: CellRendererProps<TData>) {
  if (value == null || value === '') return <span className="text-[var(--grid-cell-muted-color)]">-</span>;

  const stringValue = String(value);
  const option = column.options?.find(
    (opt) => opt.value === stringValue || opt.label.toLowerCase() === stringValue.toLowerCase()
  );

  const label = option?.label ?? stringValue;

  return (
    <span className="inline-flex items-center gap-1.5 text-[var(--grid-cell-color)]">
      {label}
      <svg
        className="w-3 h-3 text-[var(--grid-cell-muted-color)]"
        viewBox="0 0 12 12"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M3 4.5L6 7.5L9 4.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
});

// =============================================================================
// RATING CELL - Star rating display
// =============================================================================

export const RatingCell = memo(function RatingCell<TData extends GridRowData>({
  value,
  column: _column,
}: CellRendererProps<TData>) {
  void _column;
  if (value == null || value === '') return <span className="text-[var(--grid-cell-muted-color)]">-</span>;

  const rating = typeof value === 'number' ? value : parseFloat(String(value));
  if (isNaN(rating)) return <span className="text-[var(--grid-cell-muted-color)]">-</span>;

  const maxStars = 5;
  const filledStars = Math.min(Math.max(0, Math.round(rating)), maxStars);

  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: maxStars }, (_, i) => (
        <svg
          key={i}
          className={cn(
            'w-4 h-4',
            i < filledStars ? 'text-[var(--priority-medium)]' : 'text-[var(--glass-bg)]'
          )}
          viewBox="0 0 16 16"
          fill="currentColor"
        >
          <path d="M8 1.5l1.85 4.52 4.65.36-3.55 3.08 1.1 4.54L8 11.46 3.95 14l1.1-4.54L1.5 6.38l4.65-.36L8 1.5z" />
        </svg>
      ))}
    </div>
  );
});

// =============================================================================
// EMAIL CELL - With mail icon
// =============================================================================

export const EmailCell = memo(function EmailCell<TData extends GridRowData>({
  value,
  column: _column,
}: CellRendererProps<TData>) {
  void _column;
  if (value == null || value === '') return <span className="text-[var(--grid-cell-muted-color)]">-</span>;

  const email = String(value);

  return (
    <a
      href={`mailto:${email}`}
      className="inline-flex items-center gap-2 text-[var(--primary-400)] hover:text-[var(--primary-300)] hover:underline"
      onClick={(e) => e.stopPropagation()}
    >
      <svg
        className="w-4 h-4 flex-shrink-0"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <rect x="1" y="3" width="14" height="10" rx="2" />
        <path d="M1 5l7 4.5L15 5" />
      </svg>
      <span className="truncate">{email}</span>
    </a>
  );
});

// =============================================================================
// URL CELL - With link icon
// =============================================================================

export const UrlCell = memo(function UrlCell<TData extends GridRowData>({
  value,
  column: _column,
}: CellRendererProps<TData>) {
  void _column;
  if (value == null || value === '') return <span className="text-[var(--grid-cell-muted-color)]">-</span>;

  const url = String(value);
  // Extract domain for display
  let displayUrl = url;
  try {
    const urlObj = new URL(url);
    displayUrl = urlObj.hostname;
  } catch {
    // Keep original if not valid URL
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 text-[var(--primary-400)] hover:text-[var(--primary-300)] hover:underline"
      onClick={(e) => e.stopPropagation()}
    >
      <svg
        className="w-4 h-4 flex-shrink-0"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <path d="M6 10l4-4M10 10V6H6" />
        <rect x="2" y="2" width="12" height="12" rx="2" />
      </svg>
      <span className="truncate">{displayUrl}</span>
    </a>
  );
});

// =============================================================================
// PHONE CELL - With phone icon
// =============================================================================

export const PhoneCell = memo(function PhoneCell<TData extends GridRowData>({
  value,
  column: _column,
}: CellRendererProps<TData>) {
  void _column;
  if (value == null || value === '') return <span className="text-[var(--grid-cell-muted-color)]">-</span>;

  const phone = String(value);

  return (
    <a
      href={`tel:${phone}`}
      className="inline-flex items-center gap-2 text-[var(--grid-cell-color)] hover:text-[var(--primary-400)]"
      onClick={(e) => e.stopPropagation()}
    >
      <svg
        className="w-4 h-4 flex-shrink-0 text-[var(--grid-cell-muted-color)]"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <path d="M3 2h3l1.5 3.5-2 1.5a8 8 0 003.5 3.5l1.5-2L14 10v3a1 1 0 01-1 1C7 14 2 9 2 3a1 1 0 011-1z" />
      </svg>
      <span className="truncate font-mono">{phone}</span>
    </a>
  );
});

// =============================================================================
// CELL RENDERER MAP
// =============================================================================

const CELL_RENDERERS: Record<GridColumnType, React.ComponentType<CellRendererProps<GridRowData>>> = {
  text: TextCell,
  number: NumberCell,
  currency: CurrencyCell,
  percent: PercentCell,
  date: DateCell,
  datetime: DateTimeCell,
  time: TimeCell,
  duration: DurationCell,
  boolean: BooleanCell,
  status: StatusCell,
  priority: PriorityCell,
  user: UserCell,
  reference: ReferenceCell,
  tags: TagsCell,
  progress: ProgressCell,
  image: ImageCell,
  actions: ActionsCell,
  select: SelectCell,
  rating: RatingCell,
  email: EmailCell,
  url: UrlCell,
  phone: PhoneCell,
  custom: TextCell, // Fallback to text for custom
};

/**
 * Get the appropriate cell renderer for a column type
 */
export function getCellRenderer<TData extends GridRowData>(
  type: GridColumnType
): React.ComponentType<CellRendererProps<TData>> {
  return (CELL_RENDERERS[type] ?? TextCell) as unknown as React.ComponentType<CellRendererProps<TData>>;
}

// Export all cell components
export {
  TextCell as default,
};
