import React, { forwardRef, useId } from 'react';
import { AlertCircle, Search, Check } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Label text above the input */
  label?: string;
  /** Error message - shows error state */
  error?: string;
  /** Hint text below the input */
  hint?: string;
  /** Success message - shows success state */
  success?: string;
  /** Icon displayed on the left side */
  leftIcon?: React.ReactNode;
  /** Icon displayed on the right side */
  rightIcon?: React.ReactNode;
  /** Show search icon on left */
  showSearch?: boolean;
  /** Size variant */
  inputSize?: 'sm' | 'md' | 'lg';
}

/**
 * Modern input component with label, error, hint, and icon support.
 * Uses the HubbleWave design system tokens.
 *
 * @example
 * <Input label="Email" placeholder="Enter your email" />
 *
 * @example
 * <Input error="This field is required" />
 *
 * @example
 * <Input showSearch placeholder="Search..." />
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      hint,
      success,
      leftIcon,
      rightIcon,
      showSearch,
      inputSize = 'md',
      className = '',
      id,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const inputId = id || generatedId;
    const hasLeftIcon = leftIcon || showSearch;
    const hasRightContent = rightIcon || error || success;

    const sizeClasses = {
      sm: 'input-sm',
      md: '',
      lg: 'input-lg',
    };

    const getStateClass = () => {
      if (error) return 'input-error';
      if (success) return 'input-success';
      return '';
    };

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium mb-1.5 text-foreground"
          >
            {label}
          </label>
        )}
        <div className="relative">
          {hasLeftIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
              {showSearch ? <Search className="h-4 w-4" /> : leftIcon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              'input',
              sizeClasses[inputSize],
              getStateClass(),
              hasLeftIcon && 'pl-10',
              hasRightContent && 'pr-10',
              className
            )}
            aria-invalid={!!error}
            aria-describedby={
              error
                ? `${inputId}-error`
                : success
                ? `${inputId}-success`
                : hint
                ? `${inputId}-hint`
                : undefined
            }
            {...props}
          />
          {hasRightContent && (
            <div
              className={cn(
                'absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none',
                error
                  ? 'text-destructive'
                  : success
                  ? 'text-success-text'
                  : 'text-muted-foreground'
              )}
            >
              {error ? (
                <AlertCircle className="h-4 w-4" />
              ) : success ? (
                <Check className="h-4 w-4" />
              ) : (
                rightIcon
              )}
            </div>
          )}
        </div>
        {error && (
          <p
            id={`${inputId}-error`}
            className="mt-1.5 text-sm text-destructive"
          >
            {error}
          </p>
        )}
        {success && !error && (
          <p
            id={`${inputId}-success`}
            className="mt-1.5 text-sm text-success-text"
          >
            {success}
          </p>
        )}
        {hint && !error && !success && (
          <p
            id={`${inputId}-hint`}
            className="mt-1.5 text-sm text-muted-foreground"
          >
            {hint}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;
