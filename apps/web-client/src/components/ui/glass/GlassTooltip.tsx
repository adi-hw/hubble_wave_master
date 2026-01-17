/**
 * GlassTooltip - Glassmorphic Tooltip Component
 *
 * A modern tooltip with smooth animations and positioning.
 */

import React, { useState, useRef, useEffect } from 'react';
import { cn } from '../../../lib/utils';

export interface GlassTooltipProps {
  /** Tooltip content */
  content: React.ReactNode;
  /** Tooltip side */
  side?: 'top' | 'bottom' | 'left' | 'right';
  /** Tooltip alignment */
  align?: 'start' | 'center' | 'end';
  /** Delay before showing (ms) */
  delayShow?: number;
  /** Delay before hiding (ms) */
  delayHide?: number;
  /** Whether the tooltip is disabled */
  disabled?: boolean;
  /** Children to wrap */
  children: React.ReactNode;
  /** Additional class name */
  className?: string;
}

const positionStyles = {
  top: {
    start: 'bottom-full left-0 mb-2',
    center: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    end: 'bottom-full right-0 mb-2',
  },
  bottom: {
    start: 'top-full left-0 mt-2',
    center: 'top-full left-1/2 -translate-x-1/2 mt-2',
    end: 'top-full right-0 mt-2',
  },
  left: {
    start: 'right-full top-0 mr-2',
    center: 'right-full top-1/2 -translate-y-1/2 mr-2',
    end: 'right-full bottom-0 mr-2',
  },
  right: {
    start: 'left-full top-0 ml-2',
    center: 'left-full top-1/2 -translate-y-1/2 ml-2',
    end: 'left-full bottom-0 ml-2',
  },
};

const arrowStyles = {
  top: 'top-full left-1/2 -translate-x-1/2 border-t-foreground',
  bottom: 'bottom-full left-1/2 -translate-x-1/2 border-b-foreground rotate-180',
  left: 'left-full top-1/2 -translate-y-1/2 border-l-foreground -rotate-90',
  right: 'right-full top-1/2 -translate-y-1/2 border-r-foreground rotate-90',
};

export const GlassTooltip: React.FC<GlassTooltipProps> = ({
  content,
  side = 'top',
  align = 'center',
  delayShow = 200,
  delayHide = 0,
  disabled = false,
  children,
  className,
}) => {
  const [visible, setVisible] = useState(false);
  const showTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const triggerRef = useRef<HTMLDivElement>(null);

  const handleMouseEnter = () => {
    if (disabled) return;
    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    showTimeoutRef.current = setTimeout(() => setVisible(true), delayShow);
  };

  const handleMouseLeave = () => {
    if (showTimeoutRef.current) clearTimeout(showTimeoutRef.current);
    hideTimeoutRef.current = setTimeout(() => setVisible(false), delayHide);
  };

  const handleFocus = () => {
    if (disabled) return;
    setVisible(true);
  };

  const handleBlur = () => {
    setVisible(false);
  };

  useEffect(() => {
    return () => {
      if (showTimeoutRef.current) clearTimeout(showTimeoutRef.current);
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    };
  }, []);

  return (
    <div
      ref={triggerRef}
      className="relative inline-flex"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleFocus}
      onBlur={handleBlur}
    >
      {children}
      {visible && (
        <div
          role="tooltip"
          className={cn(
            'absolute z-50 pointer-events-none',
            'px-2.5 py-1.5 rounded-md text-xs font-medium',
            'bg-foreground text-background',
            'shadow-lg whitespace-nowrap max-w-xs',
            'animate-fade-in',
            positionStyles[side][align],
            className
          )}
        >
          {content}
          <span
            className={cn(
              'absolute w-0 h-0',
              'border-4 border-transparent',
              arrowStyles[side]
            )}
          />
        </div>
      )}
    </div>
  );
};

/**
 * Shortcut tooltip with keyboard hint
 */
export interface ShortcutTooltipProps extends Omit<GlassTooltipProps, 'content'> {
  /** Tooltip label */
  label: string;
  /** Keyboard shortcut */
  shortcut?: string;
}

export const ShortcutTooltip: React.FC<ShortcutTooltipProps> = ({
  label,
  shortcut,
  children,
  ...props
}) => {
  const content = (
    <span className="flex items-center gap-2">
      <span>{label}</span>
      {shortcut && <kbd className="kbd text-[10px]">{shortcut}</kbd>}
    </span>
  );

  return (
    <GlassTooltip content={content} {...props}>
      {children}
    </GlassTooltip>
  );
};

export default GlassTooltip;
