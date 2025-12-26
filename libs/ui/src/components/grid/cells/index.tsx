/**
 * Cell Renderers - Type-specific cell components for HubbleDataGrid
 *
 * Each renderer is optimized for a specific data type with appropriate
 * formatting, styling, and interaction handling.
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
// CURRENCY CELL
// =============================================================================

export const CurrencyCell = memo(function CurrencyCell<TData extends GridRowData>({
  value,
  column,
}: CellRendererProps<TData>) {
  if (value == null || value === '') return <span className="text-[var(--grid-cell-muted-color)]">-</span>;

  const numValue = typeof value === 'number' ? value : parseFloat(String(value));
  if (isNaN(numValue)) return <span className="text-[var(--grid-cell-muted-color)]">-</span>;

  const currency = column.format?.split(':')[1] || 'USD';

  return (
    <span className="font-mono text-[var(--grid-cell-color)] tabular-nums">
      {formatCurrency(numValue, currency)}
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
// DATE CELL
// =============================================================================

export const DateCell = memo(function DateCell<TData extends GridRowData>({
  value,
  column,
}: CellRendererProps<TData>) {
  if (value == null || value === '') return <span className="text-[var(--grid-cell-muted-color)]">-</span>;

  return (
    <span className="text-[var(--grid-cell-color)]">
      {formatDate(value as string | Date, column.format)}
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
    <span className="text-[var(--grid-cell-color)]">
      {formatDateTime(value as string | Date, column.format)}
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
// BOOLEAN CELL
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
// STATUS CELL
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
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium',
        'bg-opacity-15'
      )}
      style={{
        backgroundColor: `${color}20`,
        color: color,
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  );
});

// =============================================================================
// PRIORITY CELL
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
        'inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide'
      )}
      style={{ color }}
    >
      <span
        className="w-2 h-2 rounded-full"
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  );
});

// =============================================================================
// USER CELL
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

  return (
    <div className="flex items-center gap-2">
      {user.avatar ? (
        <img
          src={user.avatar}
          alt={name}
          className="w-6 h-6 rounded-full object-cover"
        />
      ) : (
        <div
          className={cn(
            'w-6 h-6 rounded-full flex items-center justify-center',
            'bg-[var(--glass-bg)] text-[var(--grid-cell-color)] text-xs font-medium'
          )}
        >
          {initials}
        </div>
      )}
      <span className="truncate text-[var(--grid-cell-color)]">{name}</span>
    </div>
  );
});

// =============================================================================
// REFERENCE CELL
// =============================================================================

export const ReferenceCell = memo(function ReferenceCell<TData extends GridRowData>({
  value,
  column: _column,
  row: _row,
}: CellRendererProps<TData>) {
  void _column;
  void _row;
  if (value == null || value === '') return <span className="text-[var(--grid-cell-muted-color)]">-</span>;

  // Value can be a string (display value) or an object with id and display
  const ref = typeof value === 'object' && value !== null
    ? (value as { id?: string; display?: string })
    : { display: String(value) };

  const displayValue = ref.display || '-';

  return (
    <span
      className={cn(
        'text-[var(--primary-400)] hover:text-[var(--primary-300)] cursor-pointer',
        'hover:underline truncate'
      )}
      title={displayValue}
    >
      {displayValue}
    </span>
  );
});

// =============================================================================
// TAGS CELL
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
    <div className="flex items-center gap-1 overflow-hidden">
      {displayTags.map((tag, i) => (
        <span
          key={i}
          className={cn(
            'inline-flex px-1.5 py-0.5 rounded text-xs',
            'bg-[var(--glass-bg)] text-[var(--grid-cell-color)]'
          )}
        >
          {tag}
        </span>
      ))}
      {remainingCount > 0 && (
        <span className="text-xs text-[var(--grid-cell-muted-color)]">
          +{remainingCount}
        </span>
      )}
    </div>
  );
});

// =============================================================================
// PROGRESS CELL
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

  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 h-2 bg-[var(--glass-bg)] rounded-full overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-300',
            clampedPercent >= 100
              ? 'bg-[var(--status-completed)]'
              : clampedPercent >= 75
              ? 'bg-[var(--primary-500)]'
              : clampedPercent >= 50
              ? 'bg-[var(--priority-medium)]'
              : 'bg-[var(--priority-high)]'
          )}
          style={{ width: `${clampedPercent}%` }}
        />
      </div>
      <span className="text-xs font-mono text-[var(--grid-cell-muted-color)] w-10 text-right">
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
