/**
 * GlassDropdown - Glassmorphic Dropdown Component
 *
 * A modern dropdown menu with translucent effects and keyboard navigation.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Check, ChevronRight } from 'lucide-react';
import { cn } from '../../../lib/utils';

export interface DropdownItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  shortcut?: string;
  disabled?: boolean;
  danger?: boolean;
  checked?: boolean;
  children?: DropdownItem[];
  onClick?: () => void;
}

export interface DropdownSeparator {
  type: 'separator';
}

export interface DropdownLabel {
  type: 'label';
  label: string;
}

export type DropdownContent = DropdownItem | DropdownSeparator | DropdownLabel;

export interface GlassDropdownProps {
  /** Trigger element */
  trigger: React.ReactNode;
  /** Dropdown items */
  items: DropdownContent[];
  /** Alignment */
  align?: 'start' | 'center' | 'end';
  /** Side */
  side?: 'top' | 'bottom';
  /** Minimum width */
  minWidth?: number;
  /** Additional class name for dropdown */
  className?: string;
}

export const GlassDropdown: React.FC<GlassDropdownProps> = ({
  trigger,
  items,
  align = 'start',
  side = 'bottom',
  minWidth = 180,
  className,
}) => {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Filter out separators and labels for keyboard navigation
  const navigableItems = items.filter(
    (item): item is DropdownItem => !('type' in item)
  );

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node) &&
        menuRef.current &&
        !menuRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };

    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!open) {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
          e.preventDefault();
          setOpen(true);
          setActiveIndex(0);
        }
        return;
      }

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setActiveIndex((prev) => (prev + 1) % navigableItems.length);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setActiveIndex((prev) => (prev - 1 + navigableItems.length) % navigableItems.length);
          break;
        case 'Enter':
        case ' ':
          e.preventDefault();
          if (activeIndex >= 0 && navigableItems[activeIndex]) {
            const item = navigableItems[activeIndex];
            if (!item.disabled && item.onClick) {
              item.onClick();
              setOpen(false);
            }
          }
          break;
        case 'Escape':
          e.preventDefault();
          setOpen(false);
          break;
      }
    },
    [open, activeIndex, navigableItems]
  );

  const alignmentClasses = {
    start: 'left-0',
    center: 'left-1/2 -translate-x-1/2',
    end: 'right-0',
  };

  const sideClasses = {
    top: 'bottom-full mb-1',
    bottom: 'top-full mt-1',
  };

  return (
    <div className="relative inline-block" ref={triggerRef}>
      <div
        onClick={() => setOpen(!open)}
        onKeyDown={handleKeyDown}
        role="button"
        tabIndex={0}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {trigger}
      </div>

      {open && (
        <div
          ref={menuRef}
          role="menu"
          style={{ minWidth }}
          className={cn(
            'absolute z-50',
            'glass-dropdown py-1',
            'bg-card backdrop-blur-xl',
            'border border-border',
            'rounded-xl shadow-lg',
            'animate-fade-in',
            alignmentClasses[align],
            sideClasses[side],
            className
          )}
        >
          {items.map((item, index) => {
            if ('type' in item) {
              if (item.type === 'separator') {
                return (
                  <div
                    key={`sep-${index}`}
                    className="my-1 mx-2 h-px bg-border"
                  />
                );
              }
              if (item.type === 'label') {
                return (
                  <div
                    key={`label-${index}`}
                    className="px-3 py-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground"
                  >
                    {item.label}
                  </div>
                );
              }
            }

            const dropdownItem = item as DropdownItem;
            const itemIndex = navigableItems.indexOf(dropdownItem);
            const isActive = itemIndex === activeIndex;

            return (
              <button
                key={dropdownItem.id}
                role="menuitem"
                disabled={dropdownItem.disabled}
                onClick={() => {
                  if (!dropdownItem.disabled && dropdownItem.onClick) {
                    dropdownItem.onClick();
                    setOpen(false);
                  }
                }}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors',
                  'focus:outline-none hover:bg-muted',
                  dropdownItem.disabled && 'opacity-50 cursor-not-allowed',
                  dropdownItem.danger ? 'text-destructive hover:bg-destructive/10' : 'text-muted-foreground hover:text-foreground',
                  isActive && !dropdownItem.danger && 'bg-muted text-foreground',
                  isActive && dropdownItem.danger && 'bg-destructive/10'
                )}
              >
                {dropdownItem.checked !== undefined && (
                  <span className="w-4 flex-shrink-0">
                    {dropdownItem.checked && <Check className="h-4 w-4" />}
                  </span>
                )}
                {dropdownItem.icon && (
                  <span className="flex-shrink-0 text-muted-foreground">
                    {dropdownItem.icon}
                  </span>
                )}
                <span className="flex-1 text-left">{dropdownItem.label}</span>
                {dropdownItem.shortcut && (
                  <kbd className="kbd text-[10px]">{dropdownItem.shortcut}</kbd>
                )}
                {dropdownItem.children && (
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

/**
 * ContextMenu - A right-click context menu
 */
export interface ContextMenuProps {
  items: DropdownContent[];
  children: React.ReactNode;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ items, children }) => {
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = () => setPosition(null);
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPosition(null);
    };

    if (position) {
      document.addEventListener('click', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [position]);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setPosition({ x: e.clientX, y: e.clientY });
  };

  return (
    <>
      <div onContextMenu={handleContextMenu}>{children}</div>
      {position && (
        <div
          ref={menuRef}
          className={cn(
            'fixed z-50 min-w-[180px]',
            'glass-dropdown py-1',
            'bg-card backdrop-blur-xl',
            'border border-border',
            'rounded-xl shadow-lg',
            'animate-fade-in'
          )}
          style={{
            left: position.x,
            top: position.y,
          }}
        >
          {items.map((item, index) => {
            if ('type' in item) {
              if (item.type === 'separator') {
                return (
                  <div
                    key={`sep-${index}`}
                    className="my-1 mx-2 h-px bg-border"
                  />
                );
              }
              if (item.type === 'label') {
                return (
                  <div
                    key={`label-${index}`}
                    className="px-3 py-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground"
                  >
                    {item.label}
                  </div>
                );
              }
            }

            const dropdownItem = item as DropdownItem;

            return (
              <button
                key={dropdownItem.id}
                disabled={dropdownItem.disabled}
                onClick={() => {
                  if (!dropdownItem.disabled && dropdownItem.onClick) {
                    dropdownItem.onClick();
                    setPosition(null);
                  }
                }}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors',
                  'hover:bg-muted',
                  dropdownItem.disabled && 'opacity-50 cursor-not-allowed',
                  dropdownItem.danger
                    ? 'text-destructive hover:bg-destructive/10'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {dropdownItem.icon && (
                  <span className="flex-shrink-0">{dropdownItem.icon}</span>
                )}
                <span className="flex-1 text-left">{dropdownItem.label}</span>
                {dropdownItem.shortcut && (
                  <kbd className="kbd text-[10px]">{dropdownItem.shortcut}</kbd>
                )}
              </button>
            );
          })}
        </div>
      )}
    </>
  );
};

export default GlassDropdown;
