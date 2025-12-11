import React from 'react';
import { FieldComponentProps } from '../types';
import { FieldWrapper, getInputClasses } from './FieldWrapper';

export const TextAreaField: React.FC<FieldComponentProps<unknown>> = ({
  field,
  value,
  onChange,
  disabled,
  readOnly,
  error,
}) => {
  // Convert value to string safely
  const strValue = value == null ? '' : typeof value === 'string' ? value : String(value);

  return (
    <FieldWrapper
      label={field.label}
      required={field.config?.validators?.required}
      error={error}
      helpText={field.config?.helpText}
    >
      <textarea
        value={strValue}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.config?.placeholder}
        disabled={disabled}
        readOnly={readOnly}
        rows={field.config?.rows || 4}
        maxLength={field.config?.validators?.maxLength}
        className={`${getInputClasses({ error, readOnly, disabled })} min-h-[100px] resize-y`}
      />
    </FieldWrapper>
  );
};
