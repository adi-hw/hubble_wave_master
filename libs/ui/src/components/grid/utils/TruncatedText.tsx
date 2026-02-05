/**
 * TruncatedText - Smart text component that shows tooltip only when truncated
 *
 * Uses ResizeObserver to detect when text is truncated and shows a custom
 * tooltip on hover. Falls back to native title attribute for simpler cases.
 */

import React, { memo, useRef, useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { cn } from './cn';

// =============================================================================
// TYPES
// =============================================================================

export interface TruncatedTextProps {
  /** The text content to display */
  children: React.ReactNode;
  /** Additional class names */
  className?: string;
  /** Maximum number of lines before truncation (default: 1) */
  lines?: number;
  /** Custom tooltip content (defaults to children text) */
  tooltip?: React.ReactNode;
  /** Placement of tooltip */
  placement?: 'top' | 'bottom' | 'left' | 'right';
  /** Delay before showing tooltip in ms */
  showDelay?: number;
}

// =============================================================================
// TOOLTIP PORTAL
// =============================================================================

interface TooltipPortalProps {
  anchorRect: DOMRect;
  content: React.ReactNode;
  placement: 'top' | 'bottom' | 'left' | 'right';
}

const TooltipPortal = memo(function TooltipPortal({
  anchorRect,
  content,
  placement,
}: TooltipPortalProps) {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const tooltip = tooltipRef.current;
    if (!tooltip) return;

    const tooltipRect = tooltip.getBoundingClientRect();
    const padding = 8;
    let top = 0;
    let left = 0;

    switch (placement) {
      case 'top':
        top = anchorRect.top - tooltipRect.height - padding;
        left = anchorRect.left + (anchorRect.width - tooltipRect.width) / 2;
        break;
      case 'bottom':
        top = anchorRect.bottom + padding;
        left = anchorRect.left + (anchorRect.width - tooltipRect.width) / 2;
        break;
      case 'left':
        top = anchorRect.top + (anchorRect.height - tooltipRect.height) / 2;
        left = anchorRect.left - tooltipRect.width - padding;
        break;
      case 'right':
        top = anchorRect.top + (anchorRect.height - tooltipRect.height) / 2;
        left = anchorRect.right + padding;
        break;
    }

    // Keep tooltip within viewport
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight,
    };

    if (left < padding) left = padding;
    if (left + tooltipRect.width > viewport.width - padding) {
      left = viewport.width - tooltipRect.width - padding;
    }
    if (top < padding) top = padding;
    if (top + tooltipRect.height > viewport.height - padding) {
      top = viewport.height - tooltipRect.height - padding;
    }

    setPosition({ top, left });
    setVisible(true);
  }, [anchorRect, placement]);

  return createPortal(
    <div
      ref={tooltipRef}
      className={cn(
        'fixed z-[9999] px-2.5 py-1.5 rounded-lg text-xs font-medium',
        'bg-popover text-popover-foreground',
        'border border-border shadow-lg',
        'max-w-xs break-words',
        'pointer-events-none',
        'transition-opacity duration-150',
        visible ? 'opacity-100' : 'opacity-0'
      )}
      style={{ top: position.top, left: position.left }}
      role="tooltip"
    >
      {content}
    </div>,
    document.body
  );
});

// =============================================================================
// TRUNCATED TEXT COMPONENT
// =============================================================================

export const TruncatedText = memo(function TruncatedText({
  children,
  className,
  lines = 1,
  tooltip,
  placement = 'top',
  showDelay = 300,
}: TruncatedTextProps) {
  const textRef = useRef<HTMLSpanElement>(null);
  const [isTruncated, setIsTruncated] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const timeoutRef = useRef<number | null>(null);

  // Check if text is truncated
  const checkTruncation = useCallback(() => {
    const el = textRef.current;
    if (!el) return;

    // For single line, compare scrollWidth vs clientWidth
    // For multi-line, compare scrollHeight vs clientHeight
    const truncated = lines === 1
      ? el.scrollWidth > el.clientWidth
      : el.scrollHeight > el.clientHeight;

    setIsTruncated(truncated);
  }, [lines]);

  // Check truncation on mount and when content changes
  useEffect(() => {
    checkTruncation();

    // Also check on resize
    const resizeObserver = new ResizeObserver(checkTruncation);
    if (textRef.current) {
      resizeObserver.observe(textRef.current);
    }

    return () => resizeObserver.disconnect();
  }, [checkTruncation, children]);

  // Handle mouse enter
  const handleMouseEnter = useCallback(() => {
    if (!isTruncated) return;

    timeoutRef.current = window.setTimeout(() => {
      const el = textRef.current;
      if (el) {
        setAnchorRect(el.getBoundingClientRect());
        setShowTooltip(true);
      }
    }, showDelay);
  }, [isTruncated, showDelay]);

  // Handle mouse leave
  const handleMouseLeave = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setShowTooltip(false);
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Get text content for tooltip
  const tooltipContent = tooltip ?? children;

  return (
    <>
      <span
        ref={textRef}
        className={cn(
          lines === 1 ? 'truncate' : 'line-clamp-' + lines,
          className
        )}
        style={lines > 1 ? {
          display: '-webkit-box',
          WebkitLineClamp: lines,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        } : undefined}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        // Use native title as fallback for accessibility
        title={isTruncated && typeof tooltipContent === 'string' ? tooltipContent : undefined}
      >
        {children}
      </span>

      {/* Custom tooltip portal */}
      {showTooltip && anchorRect && (
        <TooltipPortal
          anchorRect={anchorRect}
          content={tooltipContent}
          placement={placement}
        />
      )}
    </>
  );
});

export default TruncatedText;
