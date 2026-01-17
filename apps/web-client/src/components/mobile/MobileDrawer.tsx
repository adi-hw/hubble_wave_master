/**
 * MobileDrawer Component
 * HubbleWave Platform - Phase 1
 *
 * Production-ready mobile drawer with:
 * - Theme-aware styling using CSS variables
 * - WCAG 2.1 AA accessibility compliance
 * - Mobile-friendly 44px touch targets
 * - Swipe-to-close support
 * - Focus trap and keyboard navigation
 */

import { useEffect, useRef, ReactNode, useCallback } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useSwipe } from '../../hooks/useSwipe';

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
  position?: 'left' | 'right' | 'bottom';
  className?: string;
}

export function MobileDrawer({
  isOpen,
  onClose,
  children,
  title,
  position = 'left',
  className,
}: MobileDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Handle swipe to close
  const swipeHandlers = useSwipe({
    onSwipeLeft: position === 'left' ? onClose : undefined,
    onSwipeRight: position === 'right' ? onClose : undefined,
    onSwipeDown: position === 'bottom' ? onClose : undefined,
    threshold: 50,
  });

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Focus management
  useEffect(() => {
    if (isOpen) {
      // Focus close button or first focusable element
      if (closeButtonRef.current) {
        closeButtonRef.current.focus();
      } else if (drawerRef.current) {
        drawerRef.current.focus();
      }
    }
  }, [isOpen]);

  // Focus trap
  useEffect(() => {
    if (!isOpen || !drawerRef.current) return;

    const drawer = drawerRef.current;
    const focusableElements = drawer.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    drawer.addEventListener('keydown', handleTabKey);
    return () => drawer.removeEventListener('keydown', handleTabKey);
  }, [isOpen]);

  const handleBackdropClick = useCallback(() => {
    onClose();
  }, [onClose]);

  const positionClasses = {
    left: {
      container: 'inset-y-0 left-0',
      transform: isOpen ? 'translate-x-0' : '-translate-x-full',
      size: 'w-[85vw] max-w-sm h-full',
    },
    right: {
      container: 'inset-y-0 right-0',
      transform: isOpen ? 'translate-x-0' : 'translate-x-full',
      size: 'w-[85vw] max-w-sm h-full',
    },
    bottom: {
      container: 'inset-x-0 bottom-0',
      transform: isOpen ? 'translate-y-0' : 'translate-y-full',
      size: 'w-full h-[85vh] max-h-[600px] rounded-t-2xl',
    },
  };

  const posStyle = positionClasses[position];

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 z-40 bg-overlay/50 transition-opacity duration-300',
          isOpen
            ? 'opacity-100 pointer-events-auto'
            : 'opacity-0 pointer-events-none'
        )}
        onClick={handleBackdropClick}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label={title || 'Drawer'}
        tabIndex={-1}
        className={cn(
          'fixed z-50',
          posStyle.container,
          posStyle.size,
          posStyle.transform,
          'transition-transform duration-300 ease-out',
          'flex flex-col',
          'outline-none',
          'bg-card shadow-2xl',
          className
        )}
        {...swipeHandlers}
      >
        {/* Drag handle for bottom drawer */}
        {position === 'bottom' && (
          <div className="flex justify-center py-3">
            <div
              className="w-12 h-1.5 rounded-full bg-border"
              aria-hidden="true"
            />
          </div>
        )}

        {/* Header */}
        {title && (
          <div
            className="flex items-center justify-between px-4 py-3 border-b border-border"
          >
            <h2
              className="text-lg font-semibold text-foreground"
            >
              {title}
            </h2>
            <button
              ref={closeButtonRef}
              onClick={onClose}
              className="p-2 -mr-2 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center text-muted-foreground hover:bg-accent"
              aria-label="Close drawer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          {children}
        </div>
      </div>
    </>
  );
}
