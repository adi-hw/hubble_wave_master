/**
 * GlassInput - Glassmorphic Input Component
 *
 * A modern input with translucent effects and refined feedback.
 */

import React from 'react';
import { cn } from '../../../lib/utils';

export interface GlassInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  /** Input size */
  size?: 'sm' | 'md' | 'lg';
  /** Error state */
  error?: boolean;
  /** Success state */
  success?: boolean;
  /** Error message */
  errorMessage?: string;
  /** Helper text */
  helperText?: string;
  /** Label */
  label?: string;
  /** Left icon/addon */
  leftAddon?: React.ReactNode;
  /** Right icon/addon */
  rightAddon?: React.ReactNode;
  /** Full width */
  fullWidth?: boolean;
}

const sizeClasses = {
  sm: 'h-8 text-xs',
  md: 'h-9 text-sm',
  lg: 'h-10 text-base',
};

export const GlassInput = React.forwardRef<HTMLInputElement, GlassInputProps>(
  (
    {
      className,
      size = 'md',
      error = false,
      success = false,
      errorMessage,
      helperText,
      label,
      leftAddon,
      rightAddon,
      fullWidth = true,
      disabled,
      id,
      ...props
    },
    ref
  ) => {
    const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;

    const baseClasses = cn(
      'glass-input w-full rounded-lg px-3 transition-all duration-150',
      'bg-[var(--bg-surface)] border border-[var(--border-default)]',
      'text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)]',
      'focus:outline-none focus:border-[var(--border-focus)] focus:ring-2 focus:ring-[var(--bg-primary-subtle)]',
      'hover:border-[var(--border-hover)]',
      'disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-[var(--bg-disabled)]',
      sizeClasses[size],
      leftAddon && 'pl-10',
      rightAddon && 'pr-10',
      error && 'border-[var(--border-danger)] focus:border-[var(--border-danger)] focus:ring-[var(--bg-danger-subtle)]',
      success && 'border-[var(--border-success)] focus:border-[var(--border-success)] focus:ring-[var(--bg-success-subtle)]'
    );

    const wrapperClasses = cn(
      'relative',
      fullWidth ? 'w-full' : 'inline-block'
    );

    return (
      <div className={wrapperClasses}>
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium mb-1.5"
            style={{ color: 'var(--text-primary)' }}
          >
            {label}
          </label>
        )}
        <div className="relative">
          {leftAddon && (
            <div
              className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center"
              style={{ color: 'var(--text-muted)' }}
            >
              {leftAddon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(baseClasses, className)}
            disabled={disabled}
            aria-invalid={error}
            aria-describedby={
              errorMessage
                ? `${inputId}-error`
                : helperText
                  ? `${inputId}-helper`
                  : undefined
            }
            {...props}
          />
          {rightAddon && (
            <div
              className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center"
              style={{ color: 'var(--text-muted)' }}
            >
              {rightAddon}
            </div>
          )}
        </div>
        {errorMessage && error && (
          <p
            id={`${inputId}-error`}
            className="mt-1.5 text-xs"
            style={{ color: 'var(--text-danger)' }}
          >
            {errorMessage}
          </p>
        )}
        {helperText && !errorMessage && (
          <p
            id={`${inputId}-helper`}
            className="mt-1.5 text-xs"
            style={{ color: 'var(--text-muted)' }}
          >
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

GlassInput.displayName = 'GlassInput';

/**
 * GlassTextarea - Glassmorphic Textarea Component
 */
export interface GlassTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Error state */
  error?: boolean;
  /** Error message */
  errorMessage?: string;
  /** Helper text */
  helperText?: string;
  /** Label */
  label?: string;
  /** Full width */
  fullWidth?: boolean;
}

export const GlassTextarea = React.forwardRef<HTMLTextAreaElement, GlassTextareaProps>(
  (
    {
      className,
      error = false,
      errorMessage,
      helperText,
      label,
      fullWidth = true,
      disabled,
      id,
      rows = 4,
      ...props
    },
    ref
  ) => {
    const textareaId = id || `textarea-${Math.random().toString(36).substr(2, 9)}`;

    const baseClasses = cn(
      'glass-textarea w-full rounded-lg px-3 py-2 text-sm transition-all duration-150',
      'bg-[var(--bg-surface)] border border-[var(--border-default)]',
      'text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)]',
      'focus:outline-none focus:border-[var(--border-focus)] focus:ring-2 focus:ring-[var(--bg-primary-subtle)]',
      'hover:border-[var(--border-hover)]',
      'disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-[var(--bg-disabled)]',
      'resize-y min-h-[80px]',
      error && 'border-[var(--border-danger)] focus:border-[var(--border-danger)] focus:ring-[var(--bg-danger-subtle)]'
    );

    const wrapperClasses = cn(
      'relative',
      fullWidth ? 'w-full' : 'inline-block'
    );

    return (
      <div className={wrapperClasses}>
        {label && (
          <label
            htmlFor={textareaId}
            className="block text-sm font-medium mb-1.5"
            style={{ color: 'var(--text-primary)' }}
          >
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          className={cn(baseClasses, className)}
          disabled={disabled}
          rows={rows}
          aria-invalid={error}
          {...props}
        />
        {errorMessage && error && (
          <p className="mt-1.5 text-xs" style={{ color: 'var(--text-danger)' }}>
            {errorMessage}
          </p>
        )}
        {helperText && !errorMessage && (
          <p className="mt-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

GlassTextarea.displayName = 'GlassTextarea';

/**
 * GlassSelect - Glassmorphic Select Component
 */
export interface GlassSelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  /** Select size */
  size?: 'sm' | 'md' | 'lg';
  /** Error state */
  error?: boolean;
  /** Error message */
  errorMessage?: string;
  /** Label */
  label?: string;
  /** Placeholder option */
  placeholder?: string;
  /** Options */
  options: Array<{ value: string; label: string; disabled?: boolean }>;
  /** Full width */
  fullWidth?: boolean;
}

export const GlassSelect = React.forwardRef<HTMLSelectElement, GlassSelectProps>(
  (
    {
      className,
      size = 'md',
      error = false,
      errorMessage,
      label,
      placeholder,
      options,
      fullWidth = true,
      disabled,
      id,
      ...props
    },
    ref
  ) => {
    const selectId = id || `select-${Math.random().toString(36).substr(2, 9)}`;

    const baseClasses = cn(
      'glass-select w-full rounded-lg px-3 pr-10 transition-all duration-150 appearance-none cursor-pointer',
      'bg-[var(--bg-surface)] border border-[var(--border-default)]',
      'text-[var(--text-primary)]',
      'focus:outline-none focus:border-[var(--border-focus)] focus:ring-2 focus:ring-[var(--bg-primary-subtle)]',
      'hover:border-[var(--border-hover)]',
      'disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-[var(--bg-disabled)]',
      sizeClasses[size],
      error && 'border-[var(--border-danger)] focus:border-[var(--border-danger)] focus:ring-[var(--bg-danger-subtle)]'
    );

    const wrapperClasses = cn(
      fullWidth ? 'w-full' : 'inline-block'
    );

    return (
      <div className={wrapperClasses}>
        {label && (
          <label
            htmlFor={selectId}
            className="block text-sm font-medium mb-1.5"
            style={{ color: 'var(--text-primary)' }}
          >
            {label}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            className={cn(baseClasses, className)}
            disabled={disabled}
            {...props}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map((option) => (
              <option key={option.value} value={option.value} disabled={option.disabled}>
                {option.label}
              </option>
            ))}
          </select>
          <div
            className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: 'var(--text-muted)' }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path
                d="M2.5 4.5L6 8L9.5 4.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>
        {errorMessage && error && (
          <p className="mt-1.5 text-xs" style={{ color: 'var(--text-danger)' }}>
            {errorMessage}
          </p>
        )}
      </div>
    );
  }
);

GlassSelect.displayName = 'GlassSelect';

export default GlassInput;
