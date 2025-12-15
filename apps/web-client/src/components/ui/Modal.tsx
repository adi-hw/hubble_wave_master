/**
 * Modal - Modern Dialog Component
 *
 * A flexible, accessible modal dialog with multiple sizes and variants.
 * Uses HubbleWave design tokens for consistent styling.
 */

import React, { useEffect, useRef, useCallback } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

export interface ModalProps {
  /** Whether the modal is open */
  open: boolean;
  /** Callback when modal should close */
  onClose: () => void;
  /** Modal title */
  title?: string;
  /** Modal description/subtitle */
  description?: string;
  /** Modal content */
  children?: React.ReactNode;
  /** Modal size */
  size?: ModalSize;
  /** Whether to show the close button */
  showCloseButton?: boolean;
  /** Whether clicking the backdrop closes the modal */
  closeOnBackdropClick?: boolean;
  /** Whether pressing Escape closes the modal */
  closeOnEscape?: boolean;
  /** Footer content (typically action buttons) */
  footer?: React.ReactNode;
  /** Custom className for the modal container */
  className?: string;
  /** Whether the modal content should scroll */
  scrollable?: boolean;
  /** Icon to show in the header */
  icon?: React.ReactNode;
  /** Variant for different modal types */
  variant?: 'default' | 'danger' | 'success' | 'warning';
}

const sizeStyles: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-2xl',
  full: 'max-w-[calc(100vw-2rem)] max-h-[calc(100vh-2rem)]',
};

const variantIconStyles: Record<string, React.CSSProperties> = {
  default: { backgroundColor: 'var(--bg-primary-subtle)', color: 'var(--text-brand)' },
  danger: { backgroundColor: 'var(--bg-danger-subtle)', color: 'var(--text-danger)' },
  success: { backgroundColor: 'var(--bg-success-subtle)', color: 'var(--text-success)' },
  warning: { backgroundColor: 'var(--bg-warning-subtle)', color: 'var(--text-warning)' },
};

export const Modal: React.FC<ModalProps> = ({
  open,
  onClose,
  title,
  description,
  children,
  size = 'md',
  showCloseButton = true,
  closeOnBackdropClick = true,
  closeOnEscape = true,
  footer,
  className,
  scrollable = true,
  icon,
  variant = 'default',
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // Handle escape key
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (closeOnEscape && event.key === 'Escape') {
        onClose();
      }
    },
    [closeOnEscape, onClose]
  );

  // Focus trap and keyboard handling
  useEffect(() => {
    if (open) {
      previousActiveElement.current = document.activeElement as HTMLElement;
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';

      // Focus the modal
      setTimeout(() => {
        modalRef.current?.focus();
      }, 0);

      return () => {
        document.removeEventListener('keydown', handleKeyDown);
        document.body.style.overflow = '';
        previousActiveElement.current?.focus();
      };
    }
  }, [open, handleKeyDown]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'modal-title' : undefined}
      aria-describedby={description ? 'modal-description' : undefined}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 backdrop-blur-sm animate-fade-in"
        style={{ backgroundColor: 'var(--bg-overlay)' }}
        onClick={closeOnBackdropClick ? onClose : undefined}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        ref={modalRef}
        tabIndex={-1}
        className={cn(
          'relative w-full rounded-2xl animate-scale-in',
          sizeStyles[size],
          size === 'full' && 'h-full flex flex-col',
          className
        )}
        style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-default)',
          boxShadow: 'var(--shadow-xl)',
        }}
      >
        {/* Header */}
        {(title || showCloseButton || icon) && (
          <div
            className="flex items-start gap-4 px-6 py-4"
            style={{ borderBottom: '1px solid var(--border-subtle)' }}
          >
            {/* Icon */}
            {icon && (
              <div
                className="flex-shrink-0 h-10 w-10 rounded-xl flex items-center justify-center"
                style={variantIconStyles[variant]}
              >
                {icon}
              </div>
            )}

            {/* Title & Description */}
            <div className="flex-1 min-w-0">
              {title && (
                <h2
                  id="modal-title"
                  className="text-lg font-semibold"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {title}
                </h2>
              )}
              {description && (
                <p
                  id="modal-description"
                  className="mt-1 text-sm"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {description}
                </p>
              )}
            </div>

            {/* Close Button */}
            {showCloseButton && (
              <button
                onClick={onClose}
                className="flex-shrink-0 p-2 -m-2 rounded-lg transition-colors"
                style={{ color: 'var(--text-muted)' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                  e.currentTarget.style.color = 'var(--text-secondary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = 'var(--text-muted)';
                }}
                aria-label="Close modal"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
        )}

        {/* Body */}
        <div
          className={cn(
            'px-6 py-4',
            scrollable && 'overflow-y-auto',
            size === 'full' && 'flex-1'
          )}
          style={{ maxHeight: scrollable && size !== 'full' ? 'calc(80vh - 8rem)' : undefined }}
        >
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div
            className="flex items-center justify-end gap-3 px-6 py-4"
            style={{ borderTop: '1px solid var(--border-subtle)' }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * ConfirmModal - A preset modal for confirmation dialogs
 */
export interface ConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'default' | 'danger' | 'warning';
  loading?: boolean;
  icon?: React.ReactNode;
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
  icon,
}) => {
  const buttonVariant = variant === 'danger' ? 'danger' : variant === 'warning' ? 'warning' : 'primary';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={message}
      size="sm"
      variant={variant}
      icon={icon}
      footer={
        <>
          <button
            onClick={onClose}
            disabled={loading}
            className="btn btn-secondary"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={cn('btn', `btn-${buttonVariant}`)}
          >
            {loading ? 'Processing...' : confirmText}
          </button>
        </>
      }
    />
  );
};

export default Modal;
