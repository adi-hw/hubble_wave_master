import { useEffect, ReactNode } from 'react';
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

  const handleOptionClick = (option: ActionSheetOption) => {
    if (!option.disabled) {
      option.onClick();
      onClose();
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 z-50 bg-black/50 transition-opacity duration-300',
          isOpen
            ? 'opacity-100 pointer-events-auto'
            : 'opacity-0 pointer-events-none'
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Action Sheet */}
      <div
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
        <div className="bg-white dark:bg-slate-800 rounded-2xl overflow-hidden mb-2 shadow-xl">
          {/* Header */}
          {(title || message) && (
            <div className="px-4 py-3 text-center border-b border-slate-200 dark:border-slate-700">
              {title && (
                <h3 className="font-semibold text-slate-900 dark:text-white">
                  {title}
                </h3>
              )}
              {message && (
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  {message}
                </p>
              )}
            </div>
          )}

          {/* Options */}
          <div className="divide-y divide-slate-200 dark:divide-slate-700">
            {options.map((option, index) => (
              <button
                key={index}
                onClick={() => handleOptionClick(option)}
                disabled={option.disabled}
                className={cn(
                  'w-full flex items-center justify-center gap-2 px-4 py-3.5',
                  'text-base font-medium',
                  'transition-colors',
                  option.disabled && 'opacity-50 cursor-not-allowed',
                  option.variant === 'danger'
                    ? 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20'
                    : 'text-indigo-600 dark:text-indigo-400 hover:bg-slate-50 dark:hover:bg-slate-700/50'
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
          onClick={onClose}
          className={cn(
            'w-full bg-white dark:bg-slate-800 rounded-2xl',
            'px-4 py-3.5 text-base font-semibold',
            'text-slate-700 dark:text-slate-300',
            'hover:bg-slate-50 dark:hover:bg-slate-700',
            'transition-colors shadow-xl'
          )}
        >
          {cancelLabel}
        </button>
      </div>
    </>
  );
}
