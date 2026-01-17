/**
 * SingleSelect Component
 * HubbleWave Platform - Phase 1
 *
 * Production-ready single select dropdown with:
 * - Theme-aware styling using Tailwind CSS
 * - WCAG 2.1 AA accessibility compliance
 * - Mobile-friendly 44px touch targets
 * - Keyboard navigation support
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Check, ChevronDown, X, Search } from 'lucide-react';
import { cn } from '../../lib/utils';

interface Option {
  value: string;
  label: string;
}

interface SingleSelectProps {
  options: Option[];
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: boolean;
  readOnly?: boolean;
  searchable?: boolean;
  id?: string;
  'aria-label'?: string;
}

export const SingleSelect: React.FC<SingleSelectProps> = ({
  options,
  value,
  onChange,
  placeholder = 'Select an option...',
  disabled = false,
  readOnly = false,
  error = false,
  searchable = true,
  id,
  'aria-label': ariaLabel,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selectedOption = options.find((o) => o.value === value);

  const filteredOptions = options.filter((option) =>
    option.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
        setFocusedIndex(-1);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
    if (isOpen) {
      setFocusedIndex(-1);
    }
  }, [isOpen]);

  const handleSelect = useCallback((optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
    setSearchTerm('');
    setFocusedIndex(-1);
  }, [onChange]);

  const handleClear = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setSearchTerm('');
  }, [onChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (disabled || readOnly) return;

    switch (e.key) {
      case 'Enter':
        e.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
        } else if (focusedIndex >= 0 && focusedIndex < filteredOptions.length) {
          handleSelect(filteredOptions[focusedIndex].value);
        }
        break;
      case ' ':
        if (!isOpen) {
          e.preventDefault();
          setIsOpen(true);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setSearchTerm('');
        setFocusedIndex(-1);
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
        } else {
          setFocusedIndex((prev) =>
            prev < filteredOptions.length - 1 ? prev + 1 : prev
          );
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (isOpen) {
          setFocusedIndex((prev) => (prev > 0 ? prev - 1 : 0));
        }
        break;
      case 'Home':
        e.preventDefault();
        if (isOpen) {
          setFocusedIndex(0);
        }
        break;
      case 'End':
        e.preventDefault();
        if (isOpen) {
          setFocusedIndex(filteredOptions.length - 1);
        }
        break;
    }
  }, [disabled, readOnly, isOpen, focusedIndex, filteredOptions, handleSelect]);

  useEffect(() => {
    if (focusedIndex >= 0 && listRef.current) {
      const focusedElement = listRef.current.children[focusedIndex] as HTMLElement;
      if (focusedElement) {
        focusedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [focusedIndex]);

  const baseInputClasses = cn(
    'flex items-center justify-between w-full px-3 pr-10 py-2 min-h-[44px] rounded-lg border outline-none relative',
    disabled
      ? 'bg-muted text-muted-foreground cursor-not-allowed'
      : 'bg-card text-foreground cursor-pointer hover:bg-muted focus:border-primary focus:ring-2 focus:ring-primary/20',
    error ? 'border-destructive' : 'border-border'
  );

  if (readOnly) {
    return (
      <div
        id={id}
        className={cn(baseInputClasses, 'cursor-default bg-muted')}
        aria-label={ariaLabel}
      >
        {selectedOption?.label || '-'}
      </div>
    );
  }

  return (
    <div className="relative" ref={containerRef}>
      <div
        id={id}
        className={baseInputClasses}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        tabIndex={disabled ? -1 : 0}
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={ariaLabel || placeholder}
        aria-controls={isOpen ? `${id || 'select'}-listbox` : undefined}
        aria-activedescendant={
          focusedIndex >= 0 ? `${id || 'select'}-option-${focusedIndex}` : undefined
        }
      >
        <span
          className={cn('block truncate', !selectedOption && 'text-muted-foreground')}
        >
          {selectedOption ? selectedOption.label : placeholder}
        </span>

        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {value && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 rounded-full transition-colors min-h-[28px] min-w-[28px] flex items-center justify-center text-muted-foreground hover:text-destructive"
              aria-label="Clear selection"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <ChevronDown
            className={cn(
              'h-4 w-4 transition-transform duration-200 text-muted-foreground',
              isOpen && 'rotate-180'
            )}
            aria-hidden="true"
          />
        </div>
      </div>

      {isOpen && !disabled && (
        <div className="absolute z-50 w-full mt-1 rounded-lg overflow-hidden bg-card border border-border shadow-lg">
          {searchable && options.length > 5 && (
            <div className="p-2 bg-muted border-b border-border">
              <div className="relative">
                <Search
                  className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground"
                  aria-hidden="true"
                />
                <input
                  ref={searchInputRef}
                  type="text"
                  className="w-full py-1.5 pl-8 pr-3 text-sm rounded-md bg-card text-foreground border border-border outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setFocusedIndex(-1);
                  }}
                  onKeyDown={handleKeyDown}
                  onClick={(e) => e.stopPropagation()}
                  aria-label="Search options"
                />
              </div>
            </div>
          )}

          <div className="max-h-60 overflow-y-auto">
            {filteredOptions.length > 0 ? (
              <ul
                ref={listRef}
                className="py-1"
                role="listbox"
                id={`${id || 'select'}-listbox`}
                aria-label="Options"
              >
                {filteredOptions.map((option, index) => {
                  const isSelected = option.value === value;
                  const isFocused = index === focusedIndex;

                  return (
                    <li
                      key={option.value}
                      id={`${id || 'select'}-option-${index}`}
                      className={cn(
                        'px-3 py-2 text-sm cursor-pointer flex items-center justify-between min-h-[44px] hover:bg-muted',
                        isFocused && 'bg-muted',
                        isSelected && 'bg-primary/10 text-primary',
                        !isSelected && 'text-foreground'
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelect(option.value);
                      }}
                      role="option"
                      aria-selected={isSelected}
                    >
                      <span className="font-medium">{option.label}</span>
                      {isSelected && (
                        <Check
                          className="h-4 w-4 text-primary"
                          aria-hidden="true"
                        />
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                No options found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
