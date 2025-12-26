/**
 * GlassModal - Glassmorphic Modal Component
 *
 * A modern modal with translucent backdrop and smooth animations.
 * Supports multiple variants: center, slide-in, and full-screen.
 */

import React, { useEffect, useRef, useCallback } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { GlassButton } from './GlassButton';

export interface GlassModalProps {
  /** Whether the modal is open */
  open: boolean;
  /** Callback when modal should close */
  onClose: () => void;
  /** Modal variant */
  variant?: 'center' | 'slide-right' | 'slide-left' | 'slide-up' | 'fullscreen';
  /** Modal size */
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  /** Modal title */
  title?: string;
  /** Modal description */
  description?: string;
  /** Whether to show close button */
  showCloseButton?: boolean;
  /** Whether clicking outside closes modal */
  closeOnOutsideClick?: boolean;
  /** Whether pressing Escape closes modal */
  closeOnEscape?: boolean;
  /** Custom header content */
  header?: React.ReactNode;
  /** Custom footer content */
  footer?: React.ReactNode;
  /** Children content */
  children: React.ReactNode;
  /** Additional class name */
  className?: string;
}

const sizeClasses = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  full: 'max-w-[calc(100vw-2rem)]',
};

const slideVariants = {
  center: {
    initial: 'opacity-0 scale-95',
    animate: 'opacity-100 scale-100',
    exit: 'opacity-0 scale-95',
    position: 'inset-0 flex items-center justify-center',
  },
  'slide-right': {
    initial: 'translate-x-full',
    animate: 'translate-x-0',
    exit: 'translate-x-full',
    position: 'inset-y-0 right-0 flex',
  },
  'slide-left': {
    initial: '-translate-x-full',
    animate: 'translate-x-0',
    exit: '-translate-x-full',
    position: 'inset-y-0 left-0 flex',
  },
  'slide-up': {
    initial: 'translate-y-full',
    animate: 'translate-y-0',
    exit: 'translate-y-full',
    position: 'inset-x-0 bottom-0 flex justify-center',
  },
  fullscreen: {
    initial: 'opacity-0',
    animate: 'opacity-100',
    exit: 'opacity-0',
    position: 'inset-0 flex',
  },
};

export const GlassModal: React.FC<GlassModalProps> = ({
  open,
  onClose,
  variant = 'center',
  size = 'md',
  title,
  description,
  showCloseButton = true,
  closeOnOutsideClick = true,
  closeOnEscape = true,
  header,
  footer,
  children,
  className,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // Handle escape key
  useEffect(() => {
    if (!open || !closeOnEscape) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open, closeOnEscape, onClose]);

  // Focus trap and body scroll lock
  useEffect(() => {
    if (open) {
      previousActiveElement.current = document.activeElement as HTMLElement;
      document.body.style.overflow = 'hidden';
      modalRef.current?.focus();
    } else {
      document.body.style.overflow = '';
      previousActiveElement.current?.focus();
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (closeOnOutsideClick && e.target === e.currentTarget) {
        onClose();
      }
    },
    [closeOnOutsideClick, onClose]
  );

  if (!open) return null;

  const variantConfig = slideVariants[variant];
  const isSlideVariant = variant.startsWith('slide-');
  const isFullscreen = variant === 'fullscreen';

  return (
    <div className="fixed inset-0 z-[var(--z-modal)]">
      {/* Backdrop */}
      <div
        className={cn(
          'absolute inset-0 transition-opacity duration-300',
          open ? 'opacity-100' : 'opacity-0'
        )}
        style={{
          backgroundColor: 'var(--bg-overlay)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
        }}
        onClick={handleBackdropClick}
        aria-hidden="true"
      />

      {/* Modal Container */}
      <div
        className={cn('absolute p-4', variantConfig.position)}
        onClick={handleBackdropClick}
      >
        {/* Modal Content */}
        <div
          ref={modalRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? 'modal-title' : undefined}
          aria-describedby={description ? 'modal-description' : undefined}
          tabIndex={-1}
          className={cn(
            'glass-modal relative flex flex-col overflow-hidden',
            'bg-[var(--bg-surface)]',
            'border border-[var(--border-default)]',
            'shadow-2xl',
            'transition-all duration-300 ease-out',
            !isSlideVariant && !isFullscreen && 'rounded-2xl',
            isSlideVariant && (variant.includes('right') || variant.includes('left'))
              ? 'h-full rounded-none'
              : '',
            isSlideVariant && variant === 'slide-up'
              ? 'w-full max-h-[90vh] rounded-t-2xl'
              : '',
            isFullscreen ? 'w-full h-full' : 'w-full',
            !isSlideVariant && !isFullscreen && sizeClasses[size],
            isSlideVariant && 'w-full max-w-md',
            open ? variantConfig.animate : variantConfig.initial,
            className
          )}
        >
          {/* Header */}
          {(title || header || showCloseButton) && (
            <div
              className="flex items-start justify-between gap-4 px-6 py-4 flex-shrink-0"
              style={{ borderBottom: '1px solid var(--border-subtle)' }}
            >
              <div className="flex-1 min-w-0">
                {header || (
                  <>
                    {title && (
                      <h2
                        id="modal-title"
                        className="text-lg font-semibold truncate"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {title}
                      </h2>
                    )}
                    {description && (
                      <p
                        id="modal-description"
                        className="mt-1 text-sm"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        {description}
                      </p>
                    )}
                  </>
                )}
              </div>
              {showCloseButton && (
                <GlassButton
                  variant="ghost"
                  size="sm"
                  iconOnly
                  onClick={onClose}
                  aria-label="Close modal"
                >
                  <X className="h-4 w-4" />
                </GlassButton>
              )}
            </div>
          )}

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-6 py-4 scrollbar-thin">
            {children}
          </div>

          {/* Footer */}
          {footer && (
            <div
              className="flex items-center justify-end gap-3 px-6 py-4 flex-shrink-0"
              style={{ borderTop: '1px solid var(--border-subtle)' }}
            >
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * ConfirmModal - A pre-built confirmation dialog
 */
export interface ConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'default' | 'danger';
  loading?: boolean;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'default',
  loading = false,
}) => {
  return (
    <GlassModal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <GlassButton variant="ghost" onClick={onClose} disabled={loading}>
            {cancelText}
          </GlassButton>
          <GlassButton
            variant={variant === 'danger' ? 'danger' : 'solid'}
            onClick={onConfirm}
            loading={loading}
          >
            {confirmText}
          </GlassButton>
        </>
      }
    >
      <p style={{ color: 'var(--text-secondary)' }}>{message}</p>
    </GlassModal>
  );
};

export default GlassModal;
