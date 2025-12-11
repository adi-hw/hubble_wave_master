import React from 'react';
import { FieldComponentProps } from '../types';
import { FieldWrapper, getInputClasses } from './FieldWrapper';

export const TimeField: React.FC<FieldComponentProps<unknown>> = ({
  field,
  value,
  onChange,
  disabled,
  readOnly,
  error,
}) => {
  // Convert value to string, handling various formats
  const getTimeValue = (val: unknown): string => {
    if (val === null || val === undefined || val === '') return '';
    if (typeof val === 'string') {
      // Handle PostgreSQL time format like "14:30:00" or "14:30:00+00"
      const match = val.match(/^(\d{2}:\d{2})/);
      return match ? match[1] : val;
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
      <input
        type="time"
        value={getTimeValue(value)}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        readOnly={readOnly}
        className={getInputClasses({ error, readOnly, disabled })}
      />
    </FieldWrapper>
  );
};
