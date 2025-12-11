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
      <label className="flex items-center gap-1 text-sm font-medium text-slate-700 mb-1.5">
        <span>{label}</span>
        {required && (
          <Asterisk className="h-3 w-3 text-danger-500" aria-label="Required" />
        )}
      </label>

      {/* Field content */}
      <div className="relative">
        {children}
      </div>

      {/* Error or Help text */}
      {error ? (
        <div className="flex items-start gap-1.5 mt-1.5">
          <AlertCircle className="h-3.5 w-3.5 text-danger-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-danger-600">{error}</p>
        </div>
      ) : helpText ? (
        <div className="flex items-start gap-1.5 mt-1.5">
          <Info className="h-3.5 w-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-slate-500">{helpText}</p>
        </div>
      ) : null}
    </div>
  );
};

/**
 * Common input class names for consistent styling across all field types
 */
export const inputBaseClasses = `
  w-full px-3 py-2.5 text-sm
  border border-slate-300 rounded-lg
  bg-white text-slate-900
  placeholder:text-slate-400
  focus:outline-none focus:ring-2 focus:ring-primary-100 focus:border-primary-500
  transition-colors duration-150
`;

export const inputErrorClasses = `
  border-danger-300
  focus:border-danger-500 focus:ring-danger-100
`;

export const inputReadOnlyClasses = `
  bg-slate-50 text-slate-600 cursor-not-allowed
`;

export const inputDisabledClasses = `
  bg-slate-100 text-slate-400 cursor-not-allowed opacity-60
`;

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
