/**
 * Cell Editors - Type-specific inline editing components for HubbleDataGrid
 *
 * Features:
 * - Futuristic glassmorphic design with neon accents
 * - Save/Cancel action buttons
 * - Type-specific editors for all field types
 * - Keyboard navigation (Enter, Escape, Tab, Arrow keys)
 * - Reference field support with search autocomplete
 */

import React, { memo, useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../utils/cn';
import type {
  CellEditorProps,
  GridRowData,
  GridColumnType,
  StatusOption,
} from '../types';

// =============================================================================
// ICONS
// =============================================================================

const CheckIcon = () => (
  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const XIcon = () => (
  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const SearchIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const SpinnerIcon = () => (
  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" opacity="0.25" />
    <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
  </svg>
);

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

function formatDateForInput(value: unknown): string {
  if (!value) return '';
  const date = typeof value === 'string' ? new Date(value) : value as Date;
  if (isNaN(date.getTime())) return '';
  return date.toISOString().split('T')[0];
}

function formatDateTimeForInput(value: unknown): string {
  if (!value) return '';
  const date = typeof value === 'string' ? new Date(value) : value as Date;
  if (isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 16);
}

function formatTimeForInput(value: unknown): string {
  if (!value) return '';
  if (typeof value === 'string') {
    if (/^\d{2}:\d{2}(:\d{2})?$/.test(value)) {
      return value.slice(0, 5);
    }
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      return date.toTimeString().slice(0, 5);
    }
  }
  return '';
}

// =============================================================================
// BASE EDITOR WRAPPER - Futuristic Design with Save/Cancel
// =============================================================================

interface EditorWrapperProps {
  children: React.ReactNode;
  onSave: () => void;
  onCancel: () => void;
  validationError?: string;
  isValidating?: boolean;
  className?: string;
  showActions?: boolean;
}

const EditorWrapper = memo(function EditorWrapper({
  children,
  onSave,
  onCancel,
  validationError,
  isValidating,
  className,
  showActions = true,
}: EditorWrapperProps) {
  return (
    <div
      className={cn(
        // Full cell coverage with subtle edit state
        'absolute inset-0 z-10',
        'flex items-center',
        // Edit mode background - slightly lighter than cell
        'bg-card',
        // Subtle ring to indicate focus
        'ring-1 ring-inset ring-primary/30',
        className
      )}
    >
      {/* Main Editor Content - with padding matching cell */}
      <div className="flex-1 min-w-0 h-full flex items-center px-3">
        {children}
      </div>

      {/* Action Buttons - minimal, inline */}
      {showActions && (
        <div className="flex items-center gap-0.5 flex-shrink-0 pr-2">
          {isValidating ? (
            <div className="w-5 h-5 flex items-center justify-center text-primary">
              <SpinnerIcon />
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); e.preventDefault(); onSave(); }}
                className={cn(
                  'w-6 h-6 flex items-center justify-center rounded',
                  'text-success hover:text-success hover:bg-success/10',
                  'transition-colors duration-100',
                  'focus:outline-none'
                )}
                title="Save (Enter)"
              >
                <CheckIcon />
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); e.preventDefault(); onCancel(); }}
                className={cn(
                  'w-6 h-6 flex items-center justify-center rounded',
                  'text-muted-foreground hover:text-foreground hover:bg-muted',
                  'transition-colors duration-100',
                  'focus:outline-none'
                )}
                title="Cancel (Escape)"
              >
                <XIcon />
              </button>
            </>
          )}
        </div>
      )}

      {/* Validation Error Tooltip */}
      {validationError && (
        <div className={cn(
          'absolute left-0 top-full mt-1 z-50',
          'px-2 py-1 text-xs rounded',
          'bg-danger text-danger-foreground whitespace-nowrap',
          'shadow-lg'
        )}>
          {validationError}
        </div>
      )}
    </div>
  );
});

// =============================================================================
// SHARED EDITOR STYLES
// =============================================================================

const editorInputStyles = cn(
  'w-full h-full text-sm',
  'bg-transparent text-[var(--grid-cell-color)]',
  'border-0 outline-none',
  'placeholder:text-muted-foreground'
);

const editorInputErrorStyles = 'text-danger-text';

// =============================================================================
// TEXT EDITOR
// =============================================================================

export const TextEditor = memo(function TextEditor<TData extends GridRowData>({
  value,
  onComplete,
  onCancel,
  onNavigate,
  autoFocus = true,
  validationError,
  isValidating,
}: CellEditorProps<TData>) {
  const [localValue, setLocalValue] = useState(value != null ? String(value) : '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [autoFocus]);

  const handleSave = useCallback(() => {
    onComplete(localValue);
  }, [localValue, onComplete]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'Enter':
          e.preventDefault();
          handleSave();
          break;
        case 'Escape':
          e.preventDefault();
          onCancel();
          break;
        case 'Tab':
          e.preventDefault();
          handleSave();
          onNavigate?.(e.shiftKey ? 'prev' : 'next');
          break;
        case 'ArrowUp':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            handleSave();
            onNavigate?.('up');
          }
          break;
        case 'ArrowDown':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            handleSave();
            onNavigate?.('down');
          }
          break;
      }
    },
    [handleSave, onCancel, onNavigate]
  );

  return (
    <EditorWrapper
      onSave={handleSave}
      onCancel={onCancel}
      validationError={validationError}
      isValidating={isValidating}
    >
      <input
        ref={inputRef}
        type="text"
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onKeyDown={handleKeyDown}
        className={cn(editorInputStyles, validationError && editorInputErrorStyles)}
        placeholder="Enter text..."
      />
    </EditorWrapper>
  );
});

// =============================================================================
// NUMBER EDITOR
// =============================================================================

export const NumberEditor = memo(function NumberEditor<TData extends GridRowData>({
  value,
  onComplete,
  onCancel,
  onNavigate,
  autoFocus = true,
  validationError,
  isValidating,
}: CellEditorProps<TData>) {
  const initialValue = value != null ? String(value) : '';
  const [localValue, setLocalValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [autoFocus]);

  const handleSave = useCallback(() => {
    const numValue = localValue === '' ? null : parseFloat(localValue);
    onComplete(numValue);
  }, [localValue, onComplete]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'Enter':
          e.preventDefault();
          handleSave();
          break;
        case 'Escape':
          e.preventDefault();
          onCancel();
          break;
        case 'Tab':
          e.preventDefault();
          handleSave();
          onNavigate?.(e.shiftKey ? 'prev' : 'next');
          break;
        case 'ArrowUp':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            handleSave();
            onNavigate?.('up');
          } else if (!e.shiftKey) {
            e.preventDefault();
            const current = parseFloat(localValue) || 0;
            setLocalValue(String(current + 1));
          }
          break;
        case 'ArrowDown':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            handleSave();
            onNavigate?.('down');
          } else if (!e.shiftKey) {
            e.preventDefault();
            const current = parseFloat(localValue) || 0;
            setLocalValue(String(current - 1));
          }
          break;
      }
    },
    [localValue, handleSave, onCancel, onNavigate]
  );

  return (
    <EditorWrapper
      onSave={handleSave}
      onCancel={onCancel}
      validationError={validationError}
      isValidating={isValidating}
    >
      <input
        ref={inputRef}
        type="number"
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onKeyDown={handleKeyDown}
        className={cn(editorInputStyles, 'font-mono', validationError && editorInputErrorStyles)}
        placeholder="0"
        step="any"
      />
    </EditorWrapper>
  );
});

// =============================================================================
// CURRENCY EDITOR
// =============================================================================

export const CurrencyEditor = memo(function CurrencyEditor<TData extends GridRowData>({
  value,
  column,
  onComplete,
  onCancel,
  onNavigate,
  autoFocus = true,
  validationError,
  isValidating,
}: CellEditorProps<TData>) {
  const currencySymbol = (column as { currencySymbol?: string }).currencySymbol ?? '$';
  const initialValue = value != null ? String(value) : '';
  const [localValue, setLocalValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [autoFocus]);

  const handleSave = useCallback(() => {
    const numValue = localValue === '' ? null : parseFloat(localValue);
    onComplete(numValue);
  }, [localValue, onComplete]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'Enter':
          e.preventDefault();
          handleSave();
          break;
        case 'Escape':
          e.preventDefault();
          onCancel();
          break;
        case 'Tab':
          e.preventDefault();
          handleSave();
          onNavigate?.(e.shiftKey ? 'prev' : 'next');
          break;
      }
    },
    [handleSave, onCancel, onNavigate]
  );

  return (
    <EditorWrapper
      onSave={handleSave}
      onCancel={onCancel}
      validationError={validationError}
      isValidating={isValidating}
    >
      <div className="flex items-center w-full h-full gap-1">
        <span className="text-[var(--grid-cell-muted-color)] text-sm flex-shrink-0">
          {currencySymbol}
        </span>
        <input
          ref={inputRef}
          type="number"
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className={cn(editorInputStyles, 'font-mono tabular-nums', validationError && editorInputErrorStyles)}
          placeholder="0.00"
          step="0.01"
        />
      </div>
    </EditorWrapper>
  );
});

// =============================================================================
// PERCENT EDITOR
// =============================================================================

export const PercentEditor = memo(function PercentEditor<TData extends GridRowData>({
  value,
  onComplete,
  onCancel,
  onNavigate,
  autoFocus = true,
  validationError,
  isValidating,
}: CellEditorProps<TData>) {
  const initialValue = value != null ? String(value) : '';
  const [localValue, setLocalValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [autoFocus]);

  const handleSave = useCallback(() => {
    const numValue = localValue === '' ? null : parseFloat(localValue);
    onComplete(numValue);
  }, [localValue, onComplete]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'Enter':
          e.preventDefault();
          handleSave();
          break;
        case 'Escape':
          e.preventDefault();
          onCancel();
          break;
        case 'Tab':
          e.preventDefault();
          handleSave();
          onNavigate?.(e.shiftKey ? 'prev' : 'next');
          break;
      }
    },
    [handleSave, onCancel, onNavigate]
  );

  return (
    <EditorWrapper
      onSave={handleSave}
      onCancel={onCancel}
      validationError={validationError}
      isValidating={isValidating}
    >
      <div className="flex items-center w-full h-full gap-1">
        <input
          ref={inputRef}
          type="number"
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className={cn(editorInputStyles, 'font-mono tabular-nums text-right', validationError && editorInputErrorStyles)}
          placeholder="0"
          min="0"
          max="100"
          step="1"
        />
        <span className="text-[var(--grid-cell-muted-color)] text-sm flex-shrink-0">
          %
        </span>
      </div>
    </EditorWrapper>
  );
});

// =============================================================================
// DATE EDITOR
// =============================================================================

export const DateEditor = memo(function DateEditor<TData extends GridRowData>({
  value,
  onComplete,
  onCancel,
  onNavigate,
  autoFocus = true,
  validationError,
  isValidating,
}: CellEditorProps<TData>) {
  const [localValue, setLocalValue] = useState(formatDateForInput(value));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  const handleSave = useCallback(() => {
    const dateValue = localValue ? new Date(localValue).toISOString() : null;
    onComplete(dateValue);
  }, [localValue, onComplete]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'Enter':
          e.preventDefault();
          handleSave();
          break;
        case 'Escape':
          e.preventDefault();
          onCancel();
          break;
        case 'Tab':
          e.preventDefault();
          handleSave();
          onNavigate?.(e.shiftKey ? 'prev' : 'next');
          break;
      }
    },
    [handleSave, onCancel, onNavigate]
  );

  return (
    <EditorWrapper
      onSave={handleSave}
      onCancel={onCancel}
      validationError={validationError}
      isValidating={isValidating}
    >
      <input
        ref={inputRef}
        type="date"
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onKeyDown={handleKeyDown}
        className={cn(editorInputStyles, validationError && editorInputErrorStyles)}
      />
    </EditorWrapper>
  );
});

// =============================================================================
// DATETIME EDITOR
// =============================================================================

export const DateTimeEditor = memo(function DateTimeEditor<TData extends GridRowData>({
  value,
  onComplete,
  onCancel,
  onNavigate,
  autoFocus = true,
  validationError,
  isValidating,
}: CellEditorProps<TData>) {
  const [localValue, setLocalValue] = useState(formatDateTimeForInput(value));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  const handleSave = useCallback(() => {
    const dateValue = localValue ? new Date(localValue).toISOString() : null;
    onComplete(dateValue);
  }, [localValue, onComplete]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'Enter':
          e.preventDefault();
          handleSave();
          break;
        case 'Escape':
          e.preventDefault();
          onCancel();
          break;
        case 'Tab':
          e.preventDefault();
          handleSave();
          onNavigate?.(e.shiftKey ? 'prev' : 'next');
          break;
      }
    },
    [handleSave, onCancel, onNavigate]
  );

  return (
    <EditorWrapper
      onSave={handleSave}
      onCancel={onCancel}
      validationError={validationError}
      isValidating={isValidating}
    >
      <input
        ref={inputRef}
        type="datetime-local"
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onKeyDown={handleKeyDown}
        className={cn(editorInputStyles, validationError && editorInputErrorStyles)}
      />
    </EditorWrapper>
  );
});

// =============================================================================
// TIME EDITOR
// =============================================================================

export const TimeEditor = memo(function TimeEditor<TData extends GridRowData>({
  value,
  onComplete,
  onCancel,
  onNavigate,
  autoFocus = true,
  validationError,
  isValidating,
}: CellEditorProps<TData>) {
  const [localValue, setLocalValue] = useState(formatTimeForInput(value));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  const handleSave = useCallback(() => {
    onComplete(localValue || null);
  }, [localValue, onComplete]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'Enter':
          e.preventDefault();
          handleSave();
          break;
        case 'Escape':
          e.preventDefault();
          onCancel();
          break;
        case 'Tab':
          e.preventDefault();
          handleSave();
          onNavigate?.(e.shiftKey ? 'prev' : 'next');
          break;
      }
    },
    [handleSave, onCancel, onNavigate]
  );

  return (
    <EditorWrapper
      onSave={handleSave}
      onCancel={onCancel}
      validationError={validationError}
      isValidating={isValidating}
    >
      <input
        ref={inputRef}
        type="time"
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onKeyDown={handleKeyDown}
        className={cn(editorInputStyles, validationError && editorInputErrorStyles)}
      />
    </EditorWrapper>
  );
});

// =============================================================================
// DURATION EDITOR
// =============================================================================

export const DurationEditor = memo(function DurationEditor<TData extends GridRowData>({
  value,
  onComplete,
  onCancel,
  onNavigate,
  autoFocus = true,
  validationError,
  isValidating,
}: CellEditorProps<TData>) {
  const parseDuration = (val: unknown): { hours: number; minutes: number } => {
    if (typeof val === 'number') {
      const totalMinutes = Math.round(val / 60000);
      return { hours: Math.floor(totalMinutes / 60), minutes: totalMinutes % 60 };
    }
    if (typeof val === 'string') {
      const match = val.match(/(\d+)h\s*(\d+)m/);
      if (match) {
        return { hours: parseInt(match[1]), minutes: parseInt(match[2]) };
      }
    }
    return { hours: 0, minutes: 0 };
  };

  const initial = parseDuration(value);
  const [hours, setHours] = useState(String(initial.hours));
  const [minutes, setMinutes] = useState(String(initial.minutes));
  const hoursRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus && hoursRef.current) {
      hoursRef.current.focus();
      hoursRef.current.select();
    }
  }, [autoFocus]);

  const handleSave = useCallback(() => {
    const h = parseInt(hours) || 0;
    const m = parseInt(minutes) || 0;
    const totalMs = (h * 60 + m) * 60000;
    onComplete(totalMs);
  }, [hours, minutes, onComplete]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'Enter':
          e.preventDefault();
          handleSave();
          break;
        case 'Escape':
          e.preventDefault();
          onCancel();
          break;
        case 'Tab':
          if (e.target === hoursRef.current && !e.shiftKey) {
            return; // Let natural tab to minutes work
          }
          e.preventDefault();
          handleSave();
          onNavigate?.(e.shiftKey ? 'prev' : 'next');
          break;
      }
    },
    [handleSave, onCancel, onNavigate]
  );

  return (
    <EditorWrapper
      onSave={handleSave}
      onCancel={onCancel}
      validationError={validationError}
      isValidating={isValidating}
    >
      <div className="flex items-center gap-1 h-full">
        <input
          ref={hoursRef}
          type="number"
          value={hours}
          onChange={(e) => setHours(e.target.value)}
          onKeyDown={handleKeyDown}
          className={cn(
            'w-8 text-sm font-mono text-center tabular-nums',
            'bg-transparent text-[var(--grid-cell-color)]',
            'border-0 outline-none'
          )}
          min="0"
          placeholder="0"
        />
        <span className="text-muted-foreground text-xs">h</span>
        <input
          type="number"
          value={minutes}
          onChange={(e) => setMinutes(e.target.value)}
          onKeyDown={handleKeyDown}
          className={cn(
            'w-8 text-sm font-mono text-center tabular-nums',
            'bg-transparent text-[var(--grid-cell-color)]',
            'border-0 outline-none'
          )}
          min="0"
          max="59"
          placeholder="0"
        />
        <span className="text-muted-foreground text-xs">m</span>
      </div>
    </EditorWrapper>
  );
});

// =============================================================================
// BOOLEAN EDITOR
// =============================================================================

export const BooleanEditor = memo(function BooleanEditor<TData extends GridRowData>({
  value,
  onComplete,
  onCancel,
  onNavigate,
  validationError,
  isValidating,
}: CellEditorProps<TData>) {
  const [localValue, setLocalValue] = useState(Boolean(value));
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    buttonRef.current?.focus();
  }, []);

  const handleSave = useCallback(() => {
    onComplete(localValue);
  }, [localValue, onComplete]);

  const handleToggle = useCallback(() => {
    setLocalValue(prev => !prev);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'Enter':
        case ' ':
          e.preventDefault();
          handleSave();
          break;
        case 'Escape':
          e.preventDefault();
          onCancel();
          break;
        case 'Tab':
          e.preventDefault();
          handleSave();
          onNavigate?.(e.shiftKey ? 'prev' : 'next');
          break;
      }
    },
    [handleSave, onCancel, onNavigate]
  );

  return (
    <EditorWrapper
      onSave={handleSave}
      onCancel={onCancel}
      validationError={validationError}
      isValidating={isValidating}
    >
      <button
        ref={buttonRef}
        type="button"
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        className="h-full flex items-center gap-2 bg-transparent outline-none"
      >
        <div
          className={cn(
            'toggle-track w-7 h-4 p-0.5 flex-shrink-0 transition-colors duration-150',
            localValue && 'toggle-track-on'
          )}
        >
          <div
            className={cn(
              'toggle-thumb w-3 h-3 transition-transform duration-150',
              localValue ? 'translate-x-3' : 'translate-x-0'
            )}
          />
        </div>
        <span className={cn(
          'text-sm',
          localValue ? 'text-foreground' : 'text-muted-foreground'
        )}>
          {localValue ? 'Yes' : 'No'}
        </span>
      </button>
    </EditorWrapper>
  );
});

// =============================================================================
// STATUS EDITOR - Dropdown with options
// =============================================================================

interface StatusEditorDropdownProps {
  options: StatusOption[];
  selectedValue: string;
  onSelect: (value: string) => void;
  onClose: () => void;
}

const StatusEditorDropdown = memo(function StatusEditorDropdown({
  options,
  selectedValue,
  onSelect,
  onClose,
}: StatusEditorDropdownProps) {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number; width: number } | null>(null);

  useEffect(() => {
    const updatePosition = () => {
      const parent = dropdownRef.current?.parentElement;
      if (parent) {
        const rect = parent.getBoundingClientRect();
        setPosition({
          top: rect.bottom + 4,
          left: rect.left,
          width: Math.max(rect.width, 160),
        });
      }
    };

    updatePosition();
    window.addEventListener('scroll', updatePosition, true);
    return () => window.removeEventListener('scroll', updatePosition, true);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  if (!position) return <div ref={dropdownRef} />;

  return createPortal(
    <div
      ref={dropdownRef}
      className={cn(
        'fixed z-[9999] py-1 rounded-lg',
        'bg-popover backdrop-blur-xl',
        'border border-border',
        'shadow-lg'
      )}
      style={{
        top: position.top,
        left: position.left,
        minWidth: position.width,
      }}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onSelect(option.value)}
          className={cn(
            'w-full px-3 py-2 flex items-center gap-2 text-left',
            'hover:bg-primary/10 transition-colors',
            selectedValue === option.value && 'bg-primary/20'
          )}
        >
          {option.color && (
            <span
              className="w-3 h-3 rounded-full flex-shrink-0 ring-1 ring-border/40"
              style={{ backgroundColor: option.color }}
            />
          )}
          <span className="text-sm text-[var(--grid-cell-color)]">
            {option.label}
          </span>
        </button>
      ))}
    </div>,
    document.body
  );
});

export const StatusEditor = memo(function StatusEditor<TData extends GridRowData>({
  value,
  column,
  onComplete,
  onCancel,
  onNavigate,
  validationError,
  isValidating,
}: CellEditorProps<TData>) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentValue, setCurrentValue] = useState(value != null ? String(value) : '');
  const buttonRef = useRef<HTMLButtonElement>(null);

  const options: StatusOption[] = column.options ?? [];
  const currentOption = options.find(o => o.value === currentValue);

  useEffect(() => {
    buttonRef.current?.focus();
    setIsOpen(true);
  }, []);

  const handleSave = useCallback(() => {
    onComplete(currentValue || null);
  }, [currentValue, onComplete]);

  const handleSelect = useCallback((val: string) => {
    setCurrentValue(val);
    setIsOpen(false);
    onComplete(val);
  }, [onComplete]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'Enter':
          e.preventDefault();
          if (!isOpen) {
            setIsOpen(true);
          } else {
            handleSave();
          }
          break;
        case 'Escape':
          e.preventDefault();
          if (isOpen) {
            setIsOpen(false);
          } else {
            onCancel();
          }
          break;
        case 'Tab':
          e.preventDefault();
          handleSave();
          onNavigate?.(e.shiftKey ? 'prev' : 'next');
          break;
        case 'ArrowDown':
        case 'ArrowUp':
          e.preventDefault();
          if (!isOpen) {
            setIsOpen(true);
          } else {
            const currentIndex = options.findIndex(o => o.value === currentValue);
            const nextIndex = e.key === 'ArrowDown'
              ? Math.min(currentIndex + 1, options.length - 1)
              : Math.max(currentIndex - 1, 0);
            if (options[nextIndex]) {
              setCurrentValue(options[nextIndex].value);
            }
          }
          break;
      }
    },
    [isOpen, currentValue, options, handleSave, onCancel, onNavigate]
  );

  return (
    <EditorWrapper
      onSave={handleSave}
      onCancel={onCancel}
      validationError={validationError}
      isValidating={isValidating}
    >
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        className={cn(
          'w-full h-full flex items-center gap-2 text-left',
          'bg-transparent',
          'outline-none'
        )}
      >
        {currentOption?.color && (
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: currentOption.color }}
          />
        )}
        <span className="text-sm text-[var(--grid-cell-color)] truncate flex-1">
          {currentOption?.label ?? (currentValue || 'Select...')}
        </span>
        <svg className="w-3 h-3 text-[var(--grid-cell-muted-color)] flex-shrink-0" viewBox="0 0 12 12" fill="currentColor">
          <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>
      </button>
      {isOpen && (
        <StatusEditorDropdown
          options={options}
          selectedValue={currentValue}
          onSelect={handleSelect}
          onClose={handleClose}
        />
      )}
    </EditorWrapper>
  );
});

// =============================================================================
// PRIORITY EDITOR - Similar to Status but with priority-specific styling
// =============================================================================

export const PriorityEditor = memo(function PriorityEditor<TData extends GridRowData>(
  props: CellEditorProps<TData>
) {
  return <StatusEditor {...props as unknown as CellEditorProps<GridRowData>} />;
}) as <TData extends GridRowData>(props: CellEditorProps<TData>) => React.ReactElement;

// =============================================================================
// TAGS EDITOR
// =============================================================================

export const TagsEditor = memo(function TagsEditor<TData extends GridRowData>({
  value,
  onComplete,
  onCancel,
  onNavigate,
  autoFocus = true,
  validationError,
  isValidating,
}: CellEditorProps<TData>) {
  const initialTags = Array.isArray(value) ? value.map(String) : [];
  const [tags, setTags] = useState<string[]>(initialTags);
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  const handleSave = useCallback(() => {
    // Add any pending input as a tag before saving
    if (inputValue.trim()) {
      const newTags = [...tags, inputValue.trim()];
      onComplete(newTags);
    } else {
      onComplete(tags.length > 0 ? tags : null);
    }
  }, [tags, inputValue, onComplete]);

  const handleAddTag = useCallback(() => {
    if (inputValue.trim() && !tags.includes(inputValue.trim())) {
      setTags(prev => [...prev, inputValue.trim()]);
      setInputValue('');
    }
  }, [inputValue, tags]);

  const handleRemoveTag = useCallback((tagToRemove: string) => {
    setTags(prev => prev.filter(t => t !== tagToRemove));
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'Enter':
          e.preventDefault();
          if (inputValue.trim()) {
            handleAddTag();
          } else {
            handleSave();
          }
          break;
        case 'Escape':
          e.preventDefault();
          onCancel();
          break;
        case 'Tab':
          e.preventDefault();
          handleSave();
          onNavigate?.(e.shiftKey ? 'prev' : 'next');
          break;
        case 'Backspace':
          if (!inputValue && tags.length > 0) {
            e.preventDefault();
            setTags(prev => prev.slice(0, -1));
          }
          break;
        case ',':
        case ' ':
          if (inputValue.trim()) {
            e.preventDefault();
            handleAddTag();
          }
          break;
      }
    },
    [inputValue, tags, handleAddTag, handleSave, onCancel, onNavigate]
  );

  return (
    <EditorWrapper
      onSave={handleSave}
      onCancel={onCancel}
      validationError={validationError}
      isValidating={isValidating}
    >
      <div className={cn(
        'w-full h-full flex items-center gap-1 overflow-hidden'
      )}>
        {tags.map((tag, index) => (
          <span
            key={index}
            className={cn(
              'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs flex-shrink-0',
              'bg-[var(--primary-500)]/20 text-[var(--primary-300)]'
            )}
          >
            {tag}
            <button
              type="button"
              onClick={() => handleRemoveTag(tag)}
              className="hover:text-red-400 transition-colors ml-0.5"
            >
              <XIcon />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className={cn(
            'flex-1 min-w-[50px] h-full text-sm',
            'bg-transparent text-[var(--grid-cell-color)]',
            'outline-none border-none',
            'placeholder:text-[var(--grid-cell-muted-color)]'
          )}
          placeholder={tags.length === 0 ? 'Add tags...' : ''}
        />
      </div>
    </EditorWrapper>
  );
});

// =============================================================================
// PROGRESS EDITOR
// =============================================================================

export const ProgressEditor = memo(function ProgressEditor<TData extends GridRowData>({
  value,
  onComplete,
  onCancel,
  onNavigate,
  autoFocus = true,
  validationError,
  isValidating,
}: CellEditorProps<TData>) {
  const initialValue = typeof value === 'number' ? value : 0;
  const [localValue, setLocalValue] = useState(String(initialValue));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [autoFocus]);

  const handleSave = useCallback(() => {
    const numValue = Math.min(100, Math.max(0, parseInt(localValue) || 0));
    onComplete(numValue);
  }, [localValue, onComplete]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'Enter':
          e.preventDefault();
          handleSave();
          break;
        case 'Escape':
          e.preventDefault();
          onCancel();
          break;
        case 'Tab':
          e.preventDefault();
          handleSave();
          onNavigate?.(e.shiftKey ? 'prev' : 'next');
          break;
      }
    },
    [handleSave, onCancel, onNavigate]
  );

  const progress = Math.min(100, Math.max(0, parseInt(localValue) || 0));

  return (
    <EditorWrapper
      onSave={handleSave}
      onCancel={onCancel}
      validationError={validationError}
      isValidating={isValidating}
    >
      <div className="flex items-center gap-2 h-full w-full">
        <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-150"
            style={{
              width: `${progress}%`,
              backgroundColor: progress >= 100
                ? 'var(--color-success-500)'
                : progress >= 50
                ? 'var(--color-primary-500)'
                : 'var(--color-warning-500)',
            }}
          />
        </div>
        <input
          ref={inputRef}
          type="number"
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className={cn(
            'w-10 h-6 text-sm font-mono text-center tabular-nums',
            'bg-muted text-foreground rounded',
            'border-0 outline-none',
            'focus:bg-muted/80',
            'caret-primary'
          )}
          min="0"
          max="100"
        />
        <span className="text-muted-foreground text-xs">%</span>
      </div>
    </EditorWrapper>
  );
});

// =============================================================================
// REFERENCE EDITOR - Search and select from referenced collection
// =============================================================================

export const ReferenceEditor = memo(function ReferenceEditor<TData extends GridRowData>({
  value,
  column,
  onComplete,
  onCancel,
  onNavigate,
  autoFocus = true,
  validationError,
  isValidating,
}: CellEditorProps<TData>) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [options, setOptions] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedOption, setSelectedOption] = useState<{ id: string; label: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const referenceCollection = column.reference?.collection;
  const displayProperty = column.reference?.displayProperty ?? 'name';

  // Initialize with current value
  useEffect(() => {
    if (value && typeof value === 'object' && 'id' in value) {
      const record = value as Record<string, unknown>;
      setSelectedOption({
        id: String(record.id),
        label: String(record[displayProperty] ?? record.id),
      });
    } else if (typeof value === 'string') {
      setSelectedOption({ id: value, label: value });
    }
  }, [value, displayProperty]);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
      setIsOpen(true);
    }
  }, [autoFocus]);

  // Search for references
  useEffect(() => {
    if (!referenceCollection || !isOpen) return;

    const searchReferences = async () => {
      setIsLoading(true);
      try {
        // Get auth token from localStorage
        const token = localStorage.getItem('auth_token') || localStorage.getItem('token');
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const params = new URLSearchParams();
        params.set('pageSize', '20');
        if (searchTerm) {
          params.set('search', searchTerm);
        }

        const response = await fetch(
          `/api/data/collections/${referenceCollection}/data?${params.toString()}`,
          { headers, credentials: 'include' }
        );

        if (response.ok) {
          const result = await response.json();
          const data = Array.isArray(result) ? result : result.data ?? [];
          setOptions(data.map((item: Record<string, unknown>) => ({
            id: String(item.id),
            label: String(item[displayProperty] ?? item.name ?? item.id),
          })));
        }
      } catch (error) {
        console.error('Failed to fetch references:', error);
        setOptions([]);
      } finally {
        setIsLoading(false);
      }
    };

    const debounce = setTimeout(searchReferences, 300);
    return () => clearTimeout(debounce);
  }, [referenceCollection, searchTerm, isOpen, displayProperty]);

  const handleSave = useCallback(() => {
    onComplete(selectedOption?.id ?? null);
  }, [selectedOption, onComplete]);

  const handleSelect = useCallback((option: { id: string; label: string }) => {
    setSelectedOption(option);
    setIsOpen(false);
    onComplete(option.id);
  }, [onComplete]);

  const handleClear = useCallback(() => {
    setSelectedOption(null);
    setSearchTerm('');
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'Enter':
          e.preventDefault();
          if (isOpen && options.length > 0) {
            handleSelect(options[0]);
          } else {
            handleSave();
          }
          break;
        case 'Escape':
          e.preventDefault();
          if (isOpen) {
            setIsOpen(false);
          } else {
            onCancel();
          }
          break;
        case 'Tab':
          e.preventDefault();
          handleSave();
          onNavigate?.(e.shiftKey ? 'prev' : 'next');
          break;
        case 'ArrowDown':
          e.preventDefault();
          if (!isOpen) setIsOpen(true);
          break;
      }
    },
    [isOpen, options, handleSelect, handleSave, onCancel, onNavigate]
  );

  return (
    <EditorWrapper
      onSave={handleSave}
      onCancel={onCancel}
      validationError={validationError}
      isValidating={isValidating}
    >
      <div className="relative w-full h-full">
        <div className="w-full h-full flex items-center gap-1.5">
          <SearchIcon />
          {selectedOption ? (
            <div className="flex-1 flex items-center gap-1 min-w-0">
              <span className="text-sm text-[var(--grid-cell-color)] truncate">
                {selectedOption.label}
              </span>
              <button
                type="button"
                onClick={handleClear}
                className="text-[var(--grid-cell-muted-color)] hover:text-red-400 transition-colors flex-shrink-0"
              >
                <XIcon />
              </button>
            </div>
          ) : (
            <input
              ref={inputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setIsOpen(true);
              }}
              onFocus={() => setIsOpen(true)}
              onKeyDown={handleKeyDown}
              className={cn(
                'flex-1 h-full bg-transparent text-sm min-w-0',
                'text-[var(--grid-cell-color)]',
                'outline-none border-none',
                'placeholder:text-[var(--grid-cell-muted-color)]'
              )}
              placeholder={`Search ${referenceCollection}...`}
            />
          )}
          {isLoading && <SpinnerIcon />}
        </div>

        {/* Dropdown */}
        {isOpen && !selectedOption && (
          <div
            ref={dropdownRef}
            className={cn(
              'absolute left-0 top-full mt-1 z-50 w-full max-h-48 overflow-auto',
              'bg-popover backdrop-blur-xl rounded-lg',
              'border border-border',
              'shadow-lg'
            )}
          >
            {isLoading ? (
              <div className="px-3 py-4 text-center text-[var(--grid-cell-muted-color)] text-sm">
                <SpinnerIcon />
              </div>
            ) : options.length === 0 ? (
              <div className="px-3 py-4 text-center text-[var(--grid-cell-muted-color)] text-sm">
                {searchTerm ? 'No results found' : 'Type to search...'}
              </div>
            ) : (
              options.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => handleSelect(option)}
                  className={cn(
                    'w-full px-3 py-2 text-left text-sm',
                    'text-[var(--grid-cell-color)]',
                    'hover:bg-primary/10 transition-colors'
                  )}
                >
                  {option.label}
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </EditorWrapper>
  );
});

// =============================================================================
// USER EDITOR - Search and select users
// =============================================================================

export const UserEditor = memo(function UserEditor<TData extends GridRowData>(
  props: CellEditorProps<TData>
) {
  // Users are a special type of reference - use the same logic but target users
  const modifiedColumn = {
    ...props.column,
    reference: {
      collection: 'users',
      displayProperty: 'username',
    },
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <ReferenceEditor {...props as any} column={modifiedColumn as any} />;
}) as <TData extends GridRowData>(props: CellEditorProps<TData>) => React.ReactElement;

// =============================================================================
// CELL EDITOR MAP
// =============================================================================

const CELL_EDITORS: Partial<Record<GridColumnType, React.ComponentType<CellEditorProps<GridRowData>>>> = {
  text: TextEditor,
  number: NumberEditor,
  currency: CurrencyEditor,
  percent: PercentEditor,
  date: DateEditor,
  datetime: DateTimeEditor,
  time: TimeEditor,
  duration: DurationEditor,
  boolean: BooleanEditor,
  status: StatusEditor,
  priority: PriorityEditor,
  tags: TagsEditor,
  progress: ProgressEditor,
  reference: ReferenceEditor,
  user: UserEditor,
  // Note: image, actions are not editable inline
};

/**
 * Get the appropriate cell editor for a column type
 */
export function getCellEditor<TData extends GridRowData>(
  type: GridColumnType
): React.ComponentType<CellEditorProps<TData>> | null {
  const editor = CELL_EDITORS[type];
  return editor as unknown as React.ComponentType<CellEditorProps<TData>> | null;
}

/**
 * Check if a column type has a default editor
 */
export function hasDefaultEditor(type: GridColumnType): boolean {
  return type in CELL_EDITORS;
}

// Export all cell editor components
export { EditorWrapper };

// Export the popup editor
export { CellEditPopup, MultiCellEditPopup } from './CellEditPopup';
export type { CellEditPopupProps } from './CellEditPopup';
