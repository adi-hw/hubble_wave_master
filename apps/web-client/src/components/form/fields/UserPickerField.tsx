import React from 'react';
import { FieldComponentProps } from '../types';
import { UserPicker } from '../../fields/UserPicker';
import { FieldWrapper } from './FieldWrapper';

export const UserPickerField: React.FC<FieldComponentProps<string>> = ({
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
    <UserPicker
      value={value}
      onChange={onChange}
      required={field.config?.validators?.required}
      disabled={disabled || readOnly}
      error={!!error}
    />
  </FieldWrapper>
);
