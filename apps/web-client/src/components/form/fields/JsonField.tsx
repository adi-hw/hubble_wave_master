import React, { useMemo } from 'react';
import { FieldComponentProps } from '../types';
import { FieldWrapper, getInputClasses } from './FieldWrapper';

export const JsonField: React.FC<FieldComponentProps<any>> = ({
  field,
  value,
  onChange,
  disabled,
  readOnly,
  error,
}) => {
  // Convert value to formatted JSON string for display
  const displayValue = useMemo(() => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }, [value]);

  const handleChange = (newValue: string) => {
    if (!newValue.trim()) {
      onChange(null);
      return;
    }
    try {
      // Try to parse as JSON
      const parsed = JSON.parse(newValue);
      onChange(parsed);
    } catch {
      // If invalid JSON, store as string (will show validation error if needed)
      onChange(newValue);
    }
  };

  return (
    <FieldWrapper
      label={field.label}
      required={field.config?.validators?.required}
      error={error}
      helpText={field.config?.helpText}
    >
      <textarea
        value={displayValue}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={field.config?.placeholder || '{}'}
        disabled={disabled}
        readOnly={readOnly}
        rows={field.config?.rows || 6}
        className={`${getInputClasses({ error, readOnly, disabled })} min-h-[120px] resize-y font-mono text-sm`}
        spellCheck={false}
      />
    </FieldWrapper>
  );
};
