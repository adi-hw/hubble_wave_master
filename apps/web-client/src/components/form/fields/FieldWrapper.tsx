import React from 'react';
import { AlertCircle, Info, Asterisk } from 'lucide-react';

interface FieldWrapperProps {
  label: string;
  required?: boolean;
  error?: string;
  helpText?: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * Shared wrapper component for form fields that provides consistent styling
 * for labels, error states, and help text across all field types.
 */
export const FieldWrapper: React.FC<FieldWrapperProps> = ({
  label,
  required,
  error,
  helpText,
  children,
  className = '',
}) => {
  return (
    <div className={`field-wrapper ${className}`}>
      {/* Label */}
      <label className="flex items-center gap-1 text-sm font-medium mb-1.5 text-muted-foreground">
        <span>{label}</span>
        {required && (
          <Asterisk className="h-3 w-3 text-destructive" aria-label="Required" />
        )}
      </label>

      {/* Field content */}
      <div className="relative">
        {children}
      </div>

      {/* Error or Help text */}
      {error ? (
        <div className="flex items-start gap-1.5 mt-1.5">
          <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-destructive" />
          <p className="text-xs text-destructive">{error}</p>
        </div>
      ) : helpText ? (
        <div className="flex items-start gap-1.5 mt-1.5">
          <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">{helpText}</p>
        </div>
      ) : null}
    </div>
  );
};

/**
 * Common input class names for consistent styling across all field types.
 * Uses the `.input` class from the design system for base styling.
 */
export const inputBaseClasses = 'input w-full';

export const inputErrorClasses = 'input-error';

export const inputReadOnlyClasses = 'input-readonly';

export const inputDisabledClasses = 'input-disabled';

/**
 * Helper to combine input classes based on state
 */
export const getInputClasses = ({
  error,
  readOnly,
  disabled,
  className = '',
}: {
  error?: string;
  readOnly?: boolean;
  disabled?: boolean;
  className?: string;
}) => {
  return [
    inputBaseClasses,
    error && inputErrorClasses,
    readOnly && inputReadOnlyClasses,
    disabled && !readOnly && inputDisabledClasses,
    className,
  ]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
};
