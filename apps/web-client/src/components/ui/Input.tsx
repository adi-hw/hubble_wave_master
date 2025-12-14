import React, { forwardRef } from 'react';
import { AlertCircle, Search } from 'lucide-react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  showSearch?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      hint,
      leftIcon,
      rightIcon,
      showSearch,
      className = '',
      id,
      ...props
    },
    ref
  ) => {
    const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;
    const hasLeftIcon = leftIcon || showSearch;

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium mb-1.5 text-slate-700 dark:text-slate-300"
          >
            {label}
          </label>
        )}
        <div className="relative">
          {hasLeftIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 dark:text-slate-500">
              {showSearch ? <Search className="h-4 w-4" /> : leftIcon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            className={`
              input
              ${hasLeftIcon ? 'pl-10' : ''}
              ${rightIcon || error ? 'pr-10' : ''}
              ${error ? 'input-error' : ''}
              ${className}
            `}
            aria-invalid={!!error}
            aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
            {...props}
          />
          {(rightIcon || error) && (
            <div
              className={`absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none ${
                error ? 'text-danger-500' : 'text-slate-400 dark:text-slate-500'
              }`}
            >
              {error ? <AlertCircle className="h-4 w-4" /> : rightIcon}
            </div>
          )}
        </div>
        {error && (
          <p
            id={`${inputId}-error`}
            className="mt-1.5 text-sm text-danger-500"
          >
            {error}
          </p>
        )}
        {hint && !error && (
          <p
            id={`${inputId}-hint`}
            className="mt-1.5 text-sm text-slate-500 dark:text-slate-400"
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
