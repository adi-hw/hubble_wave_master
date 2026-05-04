import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import {
  PROPERTY_TYPES,
  getPropertyType,
  type PropertyTypeDefinition,
} from './property-types';

interface PropertyTypeSelectorProps {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
}

const renderTypeSwatch = (type: PropertyTypeDefinition) => {
  const Icon = type.icon;
  return (
    <span
      className="inline-flex h-5 w-5 items-center justify-center rounded text-white"
      style={{ backgroundColor: type.color }}
      aria-hidden
    >
      <Icon size={12} />
    </span>
  );
};

/**
 * Compact dropdown used inside grid cells. Shows a coloured swatch +
 * type label; opens a panel of all types on click. Keyboard-navigable
 * (ArrowUp / ArrowDown / Enter / Escape).
 *
 * The popover is portaled-style absolute positioning rather than a
 * shared Modal — at scale a Collection has up to ~30 properties, so
 * many dropdowns coexist. A modal-driven picker would be too heavy.
 */
export const PropertyTypeSelector: React.FC<PropertyTypeSelectorProps> = ({
  value,
  onChange,
  disabled,
}) => {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(() =>
    Math.max(0, PROPERTY_TYPES.findIndex((t) => t.value === value)),
  );
  const containerRef = useRef<HTMLDivElement | null>(null);
  const current = getPropertyType(value);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!containerRef.current) return;
      if (e.target instanceof Node && containerRef.current.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const select = (next: string) => {
    onChange(next);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!open) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => Math.min(PROPERTY_TYPES.length - 1, h + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(0, h - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      select(PROPERTY_TYPES[highlight].value);
    }
  };

  return (
    <div className="relative" ref={containerRef} onKeyDown={onKeyDown}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={[
          'inline-flex w-full items-center justify-between gap-2 rounded border border-border bg-card px-2 py-1 text-sm transition-colors',
          disabled
            ? 'cursor-not-allowed opacity-60'
            : 'hover:border-primary/40 focus:border-primary focus:outline-none',
        ].join(' ')}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2 truncate">
          {current ? renderTypeSwatch(current) : null}
          <span className="truncate text-foreground">
            {current?.label ?? value ?? 'Select type'}
          </span>
        </span>
        <ChevronDown size={14} className="text-muted-foreground" />
      </button>

      {open ? (
        <div
          className="absolute left-0 right-0 z-30 mt-1 max-h-72 overflow-auto rounded border border-border bg-card p-1 shadow-lg"
          role="listbox"
        >
          {PROPERTY_TYPES.map((type, index) => {
            const isSelected = type.value === value;
            const isHighlighted = index === highlight;
            return (
              <button
                key={type.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                onMouseEnter={() => setHighlight(index)}
                onClick={() => select(type.value)}
                className={[
                  'flex w-full items-start gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors',
                  isHighlighted ? 'bg-primary/10' : '',
                  isSelected ? 'font-medium text-foreground' : 'text-foreground',
                ].join(' ')}
              >
                {renderTypeSwatch(type)}
                <span className="flex-1">
                  <span className="block">{type.label}</span>
                  <span className="block text-xs text-muted-foreground">
                    {type.description}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
};
