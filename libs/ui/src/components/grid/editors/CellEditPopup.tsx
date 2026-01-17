/**
 * CellEditPopup - Floating editor popup for inline cell editing
 *
 * This component renders a popup window anchored to a cell that allows
 * users to edit cell values. Works for both single and multi-cell editing.
 * Features:
 * - Anchors to the cell being edited
 * - Shows the appropriate editor based on column type
 * - For multi-select: displays count of selected items with checkbox
 * - For single cell: simplified footer without checkbox
 * - Cancel/Apply buttons
 * - Modern dark theme styling matching the grid
 */

import React, { memo, useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../utils/cn';
import type {
  GridRowData,
  GridColumn,
  GridColumnType,
} from '../types';

// =============================================================================
// TYPES
// =============================================================================

export interface CellEditPopupProps<TData extends GridRowData = GridRowData> {
  /** The column being edited */
  column: GridColumn<TData>;
  /** Number of selected items (1 for single cell edit) */
  selectedCount: number;
  /** Current value */
  currentValue?: unknown;
  /** Position to anchor the popup (cell's bounding rect) */
  anchorRect: DOMRect | null;
  /** Callback when apply is clicked */
  onApply: (newValue: unknown) => void;
  /** Callback when cancelled */
  onCancel: () => void;
  /** Whether the popup is open */
  isOpen: boolean;
}

// =============================================================================
// ICONS
// =============================================================================

const CloseIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

// =============================================================================
// EDITOR COMPONENTS
// =============================================================================

interface PopupEditorProps {
  value: unknown;
  onChange: (value: unknown) => void;
  column: GridColumn<GridRowData>;
  onKeyDown: (e: React.KeyboardEvent) => void;
  autoFocus?: boolean;
}

const TextPopupEditor = memo(function TextPopupEditor({
  value,
  onChange,
  onKeyDown,
  autoFocus = true,
}: PopupEditorProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [autoFocus]);

  return (
    <input
      ref={inputRef}
      type="text"
      value={value != null ? String(value) : ''}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      className="input h-8"
      placeholder="Enter value..."
    />
  );
});

const NumberPopupEditor = memo(function NumberPopupEditor({
  value,
  onChange,
  onKeyDown,
  autoFocus = true,
}: PopupEditorProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [autoFocus]);

  return (
    <input
      ref={inputRef}
      type="number"
      value={value != null ? String(value) : ''}
      onChange={(e) => onChange(e.target.value === '' ? null : parseFloat(e.target.value))}
      onKeyDown={onKeyDown}
      className="input h-8 font-mono tabular-nums"
      placeholder="0"
      step="any"
    />
  );
});

const CurrencyPopupEditor = memo(function CurrencyPopupEditor({
  value,
  onChange,
  column,
  onKeyDown,
  autoFocus = true,
}: PopupEditorProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const currencySymbol = (column as { currencySymbol?: string }).currencySymbol ?? '$';

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [autoFocus]);

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm" style={{ color: 'var(--text-tertiary)' }}>{currencySymbol}</span>
      <input
        ref={inputRef}
        type="number"
        value={value != null ? String(value) : ''}
        onChange={(e) => onChange(e.target.value === '' ? null : parseFloat(e.target.value))}
        onKeyDown={onKeyDown}
        className="input h-8 flex-1 font-mono tabular-nums"
        placeholder="0.00"
        step="0.01"
      />
    </div>
  );
});

const DatePopupEditor = memo(function DatePopupEditor({
  value,
  onChange,
  onKeyDown,
  autoFocus = true,
}: PopupEditorProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const formatDate = (val: unknown): string => {
    if (!val) return '';
    const date = typeof val === 'string' ? new Date(val) : val as Date;
    if (isNaN(date.getTime())) return '';
    return date.toISOString().split('T')[0];
  };

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  return (
    <input
      ref={inputRef}
      type="date"
      value={formatDate(value)}
      onChange={(e) => onChange(e.target.value ? new Date(e.target.value).toISOString() : null)}
      onKeyDown={onKeyDown}
      className="input h-8 [color-scheme:dark]"
    />
  );
});

const DateTimePopupEditor = memo(function DateTimePopupEditor({
  value,
  onChange,
  onKeyDown,
  autoFocus = true,
}: PopupEditorProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const formatDateTime = (val: unknown): string => {
    if (!val) return '';
    const date = typeof val === 'string' ? new Date(val) : val as Date;
    if (isNaN(date.getTime())) return '';
    return date.toISOString().slice(0, 16);
  };

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  return (
    <input
      ref={inputRef}
      type="datetime-local"
      value={formatDateTime(value)}
      onChange={(e) => onChange(e.target.value ? new Date(e.target.value).toISOString() : null)}
      onKeyDown={onKeyDown}
      className="input h-8 [color-scheme:dark]"
    />
  );
});

const BooleanPopupEditor = memo(function BooleanPopupEditor({
  value,
  onChange,
}: PopupEditorProps) {
  const isChecked = Boolean(value);

  return (
    <div
      onClick={() => onChange(!isChecked)}
      className="flex items-center gap-3 cursor-pointer py-1"
    >
      <div
        className={cn(
          'w-10 h-5 rounded-full p-0.5 transition-colors duration-200',
          isChecked ? 'bg-success' : 'bg-[var(--bg-muted)]'
        )}
      >
        <div
          className={cn(
            'w-4 h-4 rounded-full bg-white transition-transform duration-200',
            isChecked ? 'translate-x-5' : 'translate-x-0'
          )}
        />
      </div>
      <span
        className={cn(
          'text-sm select-none',
          isChecked ? 'text-success' : 'text-tertiary'
        )}
      >
        {isChecked ? 'Yes' : 'No'}
      </span>
    </div>
  );
});

const SelectPopupEditor = memo(function SelectPopupEditor({
  value,
  onChange,
  column,
  onKeyDown,
}: PopupEditorProps) {
  const options = column.options ?? [];

  return (
    <select
      value={value != null ? String(value) : ''}
      onChange={(e) => onChange(e.target.value || null)}
      onKeyDown={onKeyDown}
      autoFocus
      className="input h-8 cursor-pointer"
    >
      <option value="">Select...</option>
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
});

const PercentPopupEditor = memo(function PercentPopupEditor({
  value,
  onChange,
  onKeyDown,
  autoFocus = true,
}: PopupEditorProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [autoFocus]);

  return (
    <div className="flex items-center gap-2">
      <input
        ref={inputRef}
        type="number"
        value={value != null ? String(value) : ''}
        onChange={(e) => onChange(e.target.value === '' ? null : parseFloat(e.target.value))}
        onKeyDown={onKeyDown}
        className="input h-8 flex-1 font-mono tabular-nums text-right"
        placeholder="0"
        min="0"
        max="100"
        step="1"
      />
      <span className="text-sm text-tertiary">%</span>
    </div>
  );
});

// Get the appropriate popup editor based on column type
function getPopupEditor(type: GridColumnType): React.ComponentType<PopupEditorProps> {
  switch (type) {
    case 'number':
      return NumberPopupEditor;
    case 'currency':
      return CurrencyPopupEditor;
    case 'percent':
    case 'progress':
      return PercentPopupEditor;
    case 'date':
      return DatePopupEditor;
    case 'datetime':
      return DateTimePopupEditor;
    case 'boolean':
      return BooleanPopupEditor;
    case 'status':
    case 'priority':
      return SelectPopupEditor;
    default:
      return TextPopupEditor;
  }
}

// =============================================================================
// CELL EDIT POPUP COMPONENT
// =============================================================================

export const CellEditPopup = memo(function CellEditPopup<TData extends GridRowData>({
  column,
  selectedCount,
  currentValue,
  anchorRect,
  onApply,
  onCancel,
  isOpen,
}: CellEditPopupProps<TData>) {
  const [localValue, setLocalValue] = useState<unknown>(currentValue);
  const popupRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  const isMultiSelect = selectedCount > 1;

  // Update local value when current value changes or popup opens
  useEffect(() => {
    if (isOpen) {
      setLocalValue(currentValue);
    }
  }, [currentValue, isOpen]);

  // Calculate position based on anchor cell
  useEffect(() => {
    if (!isOpen || !anchorRect) {
      setPosition(null);
      return;
    }

    const popupWidth = 260;
    const popupHeight = isMultiSelect ? 145 : 115;
    const gap = 4;

    let left = anchorRect.left;
    let top = anchorRect.bottom + gap;

    // Ensure popup stays within viewport horizontally
    if (left + popupWidth > window.innerWidth - 16) {
      left = Math.max(16, window.innerWidth - popupWidth - 16);
    }
    if (left < 16) {
      left = 16;
    }

    // If popup would go below viewport, position above
    if (top + popupHeight > window.innerHeight - 16) {
      top = anchorRect.top - popupHeight - gap;
    }
    if (top < 16) {
      top = 16;
    }

    setPosition({ top, left });
  }, [isOpen, anchorRect, isMultiSelect]);

  // Handle click outside to cancel
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        onCancel();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onCancel();
      }
    };

    // Use setTimeout to prevent immediate close from the triggering click
    const timeout = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);
    document.addEventListener('keydown', handleEscape);

    return () => {
      clearTimeout(timeout);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onCancel]);

  const handleApply = useCallback(() => {
    onApply(localValue);
  }, [localValue, onApply]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleApply();
    }
  }, [handleApply]);

  if (!isOpen || !position) {
    return null;
  }

  const Editor = getPopupEditor(column.type);

  return createPortal(
    <div
      ref={popupRef}
      className="fixed z-[9999] w-[260px] rounded-lg overflow-hidden"
      style={{
        top: position.top,
        left: position.left,
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border-default)',
        boxShadow: 'var(--shadow-xl)',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header with column name */}
      <div
        className="flex items-center justify-between px-3 py-2"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderBottom: '1px solid var(--border-default)',
        }}
      >
        <span
          className="text-xs font-medium uppercase tracking-wide truncate"
          style={{ color: 'var(--text-tertiary)' }}
        >
          {column.label || column.code}
        </span>
        <button
          type="button"
          onClick={onCancel}
          className="btn-ghost btn-icon w-5 h-5 !p-0 !min-w-0"
          aria-label="Close"
        >
          <CloseIcon />
        </button>
      </div>

      {/* Editor area */}
      <div
        className="px-3 py-3"
        style={{ backgroundColor: 'var(--bg-surface)' }}
      >
        <Editor
          value={localValue}
          onChange={setLocalValue}
          column={column as unknown as GridColumn<GridRowData>}
          onKeyDown={handleKeyDown}
          autoFocus
        />
      </div>

      {/* Footer */}
      <div
        className={cn(
          'flex items-center px-3 py-2',
          isMultiSelect ? 'justify-between' : 'justify-end'
        )}
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderTop: '1px solid var(--border-default)',
        }}
      >
        {isMultiSelect && (
          <label
            className="flex items-center gap-2 text-xs"
            style={{ color: 'var(--text-tertiary)' }}
          >
            <input
              type="checkbox"
              defaultChecked
              className="checkbox checkbox-sm"
            />
            <span>Update {selectedCount} selected</span>
          </label>
        )}

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="btn-secondary btn-xs"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="btn-primary btn-xs"
          >
            Apply
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}) as <TData extends GridRowData>(props: CellEditPopupProps<TData>) => React.ReactElement | null;

// Also export as MultiCellEditPopup for backwards compatibility
export const MultiCellEditPopup = CellEditPopup;

export default CellEditPopup;
