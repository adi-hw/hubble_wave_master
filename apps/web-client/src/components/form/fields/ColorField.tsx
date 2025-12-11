import React from 'react';
import { FieldComponentProps } from '../types';
import { FieldWrapper, getInputClasses } from './FieldWrapper';

export const ColorField: React.FC<FieldComponentProps<unknown>> = ({
  field,
  value,
  onChange,
  disabled,
  readOnly,
  error,
}) => {
  // Convert value to string
  const strValue = value == null ? '' : typeof value === 'string' ? value : String(value);

  return (
    <FieldWrapper
      label={field.label}
      required={field.config?.validators?.required}
      error={error}
      helpText={field.config?.helpText}
    >
      <div className="flex items-center gap-3">
        <input
          type="color"
          value={strValue || '#000000'}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled || readOnly}
          className="w-12 h-10 p-1 border border-slate-300 rounded-lg cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <input
          type="text"
          value={strValue}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#000000"
          disabled={disabled}
          readOnly={readOnly}
          maxLength={7}
          className={`${getInputClasses({ error, readOnly, disabled })} flex-1 font-mono uppercase`}
        />
        {strValue && (
          <div
            className="w-10 h-10 rounded-lg border border-slate-200 shadow-inner"
            style={{ backgroundColor: strValue }}
            title={strValue}
          />
        )}
      </div>
    </FieldWrapper>
  );
};
