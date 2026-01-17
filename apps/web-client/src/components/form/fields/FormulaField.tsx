import React, { useMemo } from 'react';
import { FieldComponentProps } from '../types';
import { FieldWrapper } from './FieldWrapper';

interface FormulaConfig {
  formula?: string;
  returnType?: 'string' | 'number' | 'boolean' | 'date' | 'datetime';
  cacheStrategy?: 'never' | 'on_save' | 'periodic' | 'real_time';
}

/**
 * FormulaField - Displays computed formula values
 *
 * Formula fields are read-only and display the calculated result of a formula.
 * The actual calculation is performed server-side.
 */
export const FormulaField: React.FC<FieldComponentProps<unknown>> = ({
  field,
  value,
  error,
}) => {
  const config = field.config as FormulaConfig | undefined;
  const returnType = config?.returnType ?? 'string';

  // Format the display value based on return type
  const displayValue = useMemo(() => {
    if (value === null || value === undefined) {
      return <span className="text-muted-foreground">Not calculated</span>;
    }

    switch (returnType) {
      case 'number':
        const numVal = typeof value === 'number' ? value : parseFloat(String(value));
        if (isNaN(numVal)) return String(value);
        return numVal.toLocaleString(undefined, { maximumFractionDigits: 4 });

      case 'boolean':
        const boolVal = value === true || value === 'true' || value === 1;
        return (
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
              boolVal ? 'bg-success-subtle text-success-text' : 'bg-danger-subtle text-danger-text'
            }`}
          >
            {boolVal ? 'True' : 'False'}
          </span>
        );

      case 'date':
        if (value instanceof Date) {
          return value.toLocaleDateString();
        }
        const dateVal = new Date(String(value));
        return isNaN(dateVal.getTime()) ? String(value) : dateVal.toLocaleDateString();

      case 'datetime':
        if (value instanceof Date) {
          return value.toLocaleString();
        }
        const datetimeVal = new Date(String(value));
        return isNaN(datetimeVal.getTime()) ? String(value) : datetimeVal.toLocaleString();

      default:
        return String(value);
    }
  }, [value, returnType]);

  return (
    <FieldWrapper
      label={field.label}
      required={false}
      error={error}
      helpText={field.config?.helpText}
    >
      <div className="px-3 py-2 rounded-md text-sm bg-muted text-foreground border border-border">
        <div className="flex items-center gap-2">
          <span className="flex-shrink-0" title="Formula field">
            <svg
              className="w-4 h-4 text-primary"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
              />
            </svg>
          </span>
          <span className="flex-1 truncate">{displayValue}</span>
        </div>
      </div>
      {config?.formula && (
        <div
          className="mt-1 text-xs font-mono px-2 py-1 rounded bg-muted text-muted-foreground"
          title="Formula expression"
        >
          = {config.formula}
        </div>
      )}
    </FieldWrapper>
  );
};
