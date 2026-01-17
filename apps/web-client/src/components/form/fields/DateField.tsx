import React from 'react';
import { Calendar } from 'lucide-react';
import { FieldComponentProps } from '../types';
import { FieldWrapper, getInputClasses } from './FieldWrapper';

export const DateField: React.FC<FieldComponentProps<unknown>> = ({
  field,
  value,
  onChange,
  disabled,
  readOnly,
  error,
}) => {
  // Convert value to string in YYYY-MM-DD format
  const getDateValue = (val: unknown): string => {
    if (val === null || val === undefined || val === '') return '';
    if (typeof val === 'string') {
      // Handle ISO date strings like "2025-01-15T00:00:00.000Z" or "2025-01-15"
      const match = val.match(/^(\d{4}-\d{2}-\d{2})/);
      return match ? match[1] : val;
    }
    if (val instanceof Date) {
      return val.toISOString().split('T')[0];
    }
    return String(val);
  };

  return (
    <FieldWrapper
      label={field.label}
      required={field.config?.validators?.required}
      error={error}
      helpText={field.config?.helpText}
    >
      <div className="relative">
        <input
          type="date"
          value={getDateValue(value)}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled || readOnly}
          min={field.config?.validators?.minDate}
          max={field.config?.validators?.maxDate}
          className={`${getInputClasses({ error, readOnly, disabled })} pr-10`}
        />
        <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none text-muted-foreground" />
      </div>
    </FieldWrapper>
  );
};
