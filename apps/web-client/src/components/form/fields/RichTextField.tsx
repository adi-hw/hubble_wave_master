import React from 'react';
import { FieldComponentProps } from '../types';
import { RichTextEditor } from '../../widgets/RichTextEditor';
import { FieldWrapper } from './FieldWrapper';

export const RichTextField: React.FC<FieldComponentProps<string>> = ({
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
    <RichTextEditor
      value={value || ''}
      onChange={onChange}
      placeholder={field.config?.placeholder || `Enter ${field.label}...`}
      readOnly={disabled || readOnly}
      error={!!error}
    />
  </FieldWrapper>
);
