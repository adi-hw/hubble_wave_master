/**
 * ActionSheet Component
 * HubbleWave Platform - Phase 1
 *
 * Production-ready mobile action sheet with:
 * - Theme-aware styling using CSS variables
 * - WCAG 2.1 AA accessibility compliance
 * - Mobile-friendly 44px touch targets
 * - Focus trap and keyboard navigation
 */

import { useEffect, useRef, ReactNode, useCallback } from 'react';
import { cn } from '../../lib/utils';

interface ActionSheetOption {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  variant?: 'default' | 'danger';
  disabled?: boolean;
}

interface ActionSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
  options: ActionSheetOption[];
  cancelLabel?: string;
  className?: string;
}

export function ActionSheet({
  isOpen,
  onClose,
  title,
  message,
  options,
  cancelLabel = 'Cancel',
  className,
}: ActionSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  // Lock body scroll when open
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

  // Focus first option when opened
  useEffect(() => {
    if (isOpen && sheetRef.current) {
      const firstButton = sheetRef.current.querySelector('button');
      if (firstButton) {
        firstButton.focus();
      }
    }
  }, [isOpen]);

  // Focus trap
  useEffect(() => {
    if (!isOpen || !sheetRef.current) return;

    const sheet = sheetRef.current;
    const focusableElements = sheet.querySelectorAll('button:not([disabled])');
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

    sheet.addEventListener('keydown', handleTabKey);
    return () => sheet.removeEventListener('keydown', handleTabKey);
  }, [isOpen]);

  const handleOptionClick = useCallback((option: ActionSheetOption) => {
    if (!option.disabled) {
      option.onClick();
      onClose();
    }
  }, [onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 z-50 bg-overlay/50 transition-opacity duration-300',
          isOpen
            ? 'opacity-100 pointer-events-auto'
            : 'opacity-0 pointer-events-none'
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Action Sheet */}
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label={title || 'Action sheet'}
        className={cn(
          'fixed inset-x-0 bottom-0 z-50',
          'transition-transform duration-300 ease-out',
          isOpen ? 'translate-y-0' : 'translate-y-full',
          'p-4 pb-safe',
          className
        )}
      >
        {/* Main options card */}
        <div
          className="rounded-2xl overflow-hidden mb-2 bg-card shadow-xl"
        >
          {/* Header */}
          {(title || message) && (
            <div
              className="px-4 py-3 text-center border-b border-border"
            >
              {title && (
                <h3
                  className="font-semibold text-foreground"
                >
                  {title}
                </h3>
              )}
              {message && (
                <p
                  className="text-sm mt-1 text-muted-foreground"
                >
                  {message}
                </p>
              )}
            </div>
          )}

          {/* Options */}
          <div>
            {options.map((option, index) => (
              <button
                key={index}
                onClick={() => handleOptionClick(option)}
                disabled={option.disabled}
                className={cn(
                  'w-full flex items-center justify-center gap-2 px-4',
                  'text-base font-medium',
                  'transition-colors min-h-[52px]',
                  'hover:bg-muted',
                  index > 0 && 'border-t border-border',
                  option.variant === 'danger'
                    ? 'text-destructive hover:bg-destructive/10'
                    : 'text-primary',
                  option.disabled && 'opacity-50 cursor-not-allowed'
                )}
              >
                {option.icon}
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* Cancel button */}
        <button
          ref={cancelButtonRef}
          onClick={onClose}
          className="w-full rounded-2xl px-4 text-base font-semibold transition-colors min-h-[52px] bg-card text-foreground shadow-xl hover:bg-muted"
        >
          {cancelLabel}
        </button>
      </div>
    </>
  );
}
