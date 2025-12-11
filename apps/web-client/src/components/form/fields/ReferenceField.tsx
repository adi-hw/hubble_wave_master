import React from 'react';
import { FieldComponentProps } from '../types';
import { ReferenceSelector } from '../../fields/ReferenceSelector';
import { FieldWrapper } from './FieldWrapper';

export const ReferenceField: React.FC<FieldComponentProps<string>> = ({
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
    <ReferenceSelector
      value={value}
      onChange={onChange}
      required={field.config?.validators?.required}
      referenceTable={field.config?.referenceTable || ''}
      disabled={disabled || readOnly}
      error={!!error}
    />
  </FieldWrapper>
);
