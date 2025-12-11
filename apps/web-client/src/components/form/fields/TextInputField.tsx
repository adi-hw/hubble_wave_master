import React from 'react';
import { FieldComponentProps } from '../types';
import { FieldWrapper, getInputClasses } from './FieldWrapper';

export const TextInputField: React.FC<FieldComponentProps<unknown>> = ({
  field,
  value,
  onChange,
  disabled,
  readOnly,
  error,
}) => {
  const inputType = field.type === 'email' ? 'email'
    : field.type === 'url' ? 'url'
    : field.type === 'phone' ? 'tel'
    : 'text';

  // Convert value to string safely
  const strValue = value == null ? '' : typeof value === 'string' ? value : String(value);

  return (
    <FieldWrapper
      label={field.label}
      required={field.config?.validators?.required}
      error={error}
      helpText={field.config?.helpText}
    >
      <input
        type={inputType}
        value={strValue}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.config?.placeholder}
        disabled={disabled}
        readOnly={readOnly}
        maxLength={field.config?.validators?.maxLength}
        className={getInputClasses({ error, readOnly, disabled })}
      />
    </FieldWrapper>
  );
};
