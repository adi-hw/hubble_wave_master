/**
 * GlassPanel - Glassmorphic Panel Component
 *
 * A sliding panel for sidebars, drawers, and overlay content.
 */

import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { GlassButton } from './GlassButton';

export interface GlassPanelProps {
  /** Whether the panel is open */
  open: boolean;
  /** Callback when panel should close */
  onClose: () => void;
  /** Panel side */
  side?: 'left' | 'right';
  /** Panel width */
  width?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  /** Panel title */
  title?: string;
  /** Whether to show close button */
  showCloseButton?: boolean;
  /** Whether clicking outside closes panel */
  closeOnOutsideClick?: boolean;
  /** Whether pressing Escape closes panel */
  closeOnEscape?: boolean;
  /** Custom header */
  header?: React.ReactNode;
  /** Custom footer */
  footer?: React.ReactNode;
  /** Children content */
  children: React.ReactNode;
  /** Additional class name */
  className?: string;
}

const widthClasses = {
  sm: 'w-72',
  md: 'w-96',
  lg: 'w-[480px]',
  xl: 'w-[600px]',
  full: 'w-screen',
};

export const GlassPanel: React.FC<GlassPanelProps> = ({
  open,
  onClose,
  side = 'right',
  width = 'md',
  title,
  showCloseButton = true,
  closeOnOutsideClick = true,
  closeOnEscape = true,
  header,
  footer,
  children,
  className,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);

  // Handle escape key
  useEffect(() => {
    if (!open || !closeOnEscape) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open, closeOnEscape, onClose]);

  // Lock body scroll
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (closeOnOutsideClick && e.target === e.currentTarget) {
      onClose();
    }
  };

  const slideClasses = {
    left: {
      container: 'left-0',
      translate: open ? 'translate-x-0' : '-translate-x-full',
    },
    right: {
      container: 'right-0',
      translate: open ? 'translate-x-0' : 'translate-x-full',
    },
  };

  return (
    <div
      className={cn(
        'fixed inset-0 z-[var(--z-modal)]',
        'transition-opacity duration-300',
        open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
      )}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{
          backgroundColor: 'var(--bg-overlay)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
        }}
        onClick={handleBackdropClick}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className={cn(
          'absolute inset-y-0 flex flex-col',
          'bg-[var(--bg-surface)]',
          'border-l border-[var(--border-default)]',
          'shadow-2xl',
          'transition-transform duration-300 ease-out',
          widthClasses[width],
          slideClasses[side].container,
          slideClasses[side].translate,
          className
        )}
      >
        {/* Header */}
        {(title || header || showCloseButton) && (
          <div
            className="flex items-center justify-between gap-4 px-4 py-3 flex-shrink-0"
            style={{ borderBottom: '1px solid var(--border-subtle)' }}
          >
            {header || (
              <h2
                className="text-lg font-semibold truncate"
                style={{ color: 'var(--text-primary)' }}
              >
                {title}
              </h2>
            )}
            {showCloseButton && (
              <GlassButton
                variant="ghost"
                size="sm"
                iconOnly
                onClick={onClose}
                aria-label="Close panel"
              >
                <X className="h-4 w-4" />
              </GlassButton>
            )}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto scrollbar-thin px-4 py-4">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div
            className="flex items-center justify-end gap-3 px-4 py-3 flex-shrink-0"
            style={{ borderTop: '1px solid var(--border-subtle)' }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

export default GlassPanel;
