import React from 'react';
import { Clock } from 'lucide-react';
import { FieldComponentProps } from '../types';
import { FieldWrapper, getInputClasses } from './FieldWrapper';

export const DateTimeField: React.FC<FieldComponentProps<unknown>> = ({
  field,
  value,
  onChange,
  disabled,
  readOnly,
  error,
}) => {
  // Convert value to datetime-local format (YYYY-MM-DDTHH:mm)
  const getDateTimeValue = (val: unknown): string => {
    if (val === null || val === undefined || val === '') return '';
    if (typeof val === 'string') {
      // Handle ISO date strings like "2025-01-15T14:30:00.000Z"
      const match = val.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
      if (match) return `${match[1]}T${match[2]}`;
      // Handle PostgreSQL timestamp format
      const pgMatch = val.match(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})/);
      if (pgMatch) return `${pgMatch[1]}T${pgMatch[2]}`;
      return val;
    }
    if (val instanceof Date) {
      return val.toISOString().slice(0, 16);
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
          type="datetime-local"
          value={getDateTimeValue(value)}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled || readOnly}
          min={field.config?.validators?.minDate}
          max={field.config?.validators?.maxDate}
          className={`${getInputClasses({ error, readOnly, disabled })} pr-10`}
        />
        <Clock className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none text-muted-foreground" />
      </div>
    </FieldWrapper>
  );
};
