import React from 'react';
import { FieldComponentProps } from '../types';
import { FileUploader } from '../../widgets/FileUploader';
import { FieldWrapper } from './FieldWrapper';

export const FileField: React.FC<FieldComponentProps<any>> = ({
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
    <FileUploader
      value={value}
      onChange={onChange}
      label={`Upload ${field.label}`}
      disabled={disabled || readOnly}
      accept={field.type === 'image' ? 'image/*' : field.config?.accept}
      maxSize={field.config?.maxSize}
      error={!!error}
    />
  </FieldWrapper>
);
