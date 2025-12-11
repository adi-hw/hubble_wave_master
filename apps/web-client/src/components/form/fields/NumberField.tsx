import React from 'react';
import { FieldComponentProps } from '../types';
import { FieldWrapper, getInputClasses } from './FieldWrapper';

export const NumberField: React.FC<FieldComponentProps<unknown>> = ({
  field,
  value,
  onChange,
  disabled,
  readOnly,
  error,
}) => {
  // Determine step based on field type
  const step = field.type === 'decimal' || field.type === 'currency' || field.type === 'percent'
    ? '0.01'
    : '1';

  // Format display for currency/percent
  const prefix = field.type === 'currency' ? field.config?.currencySymbol || '$' : '';
  const suffix = field.type === 'percent' ? '%' : '';

  // Convert value to string/number safely
  const numValue = value == null ? '' : typeof value === 'number' ? value : typeof value === 'string' ? value : String(value);

  return (
    <FieldWrapper
      label={field.label}
      required={field.config?.validators?.required}
      error={error}
      helpText={field.config?.helpText}
    >
      <div className="relative">
        {prefix && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">
            {prefix}
          </span>
        )}
        <input
          type="number"
          value={numValue}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.config?.placeholder}
          disabled={disabled}
          readOnly={readOnly}
          step={step}
          min={field.config?.validators?.min}
          max={field.config?.validators?.max}
          className={`${getInputClasses({ error, readOnly, disabled })} ${prefix ? 'pl-7' : ''} ${suffix ? 'pr-8' : ''}`}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">
            {suffix}
          </span>
        )}
      </div>
    </FieldWrapper>
  );
};
