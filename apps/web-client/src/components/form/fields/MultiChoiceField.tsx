import React from 'react';
import { FieldComponentProps } from '../types';
import { MultiSelect } from '../../widgets/MultiSelect';
import { FieldWrapper } from './FieldWrapper';

export const MultiChoiceField: React.FC<FieldComponentProps<string[]>> = ({
  field,
  value,
  onChange,
  disabled,
  readOnly,
  error,
}) => (
  <FieldWrapper
    label={field.label}
    required={field.config?.validators?.required}
    error={error}
    helpText={field.config?.helpText}
  >
    <MultiSelect
      options={field.config?.choices || []}
      value={value || []}
      onChange={onChange}
      placeholder={field.config?.placeholder || `Select ${field.label}...`}
      disabled={disabled || readOnly}
      error={!!error}
    />
  </FieldWrapper>
);
