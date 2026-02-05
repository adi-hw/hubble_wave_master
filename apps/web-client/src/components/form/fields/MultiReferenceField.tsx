import React from 'react';
import { FieldComponentProps } from '../types';
import { MultiReferenceSelector } from '../../fields/MultiReferenceSelector';
import { FieldWrapper } from './FieldWrapper';

export const MultiReferenceField: React.FC<FieldComponentProps<string[]>> = ({
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
    <MultiReferenceSelector
      value={value ?? []}
      onChange={onChange}
      required={field.config?.validators?.required}
      referenceCollection={field.config?.referenceCollection || ''}
      disabled={disabled || readOnly}
      error={!!error}
    />
  </FieldWrapper>
);
