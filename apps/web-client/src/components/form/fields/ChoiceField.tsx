import React from 'react';
import { ChevronDown } from 'lucide-react';
import { FieldComponentProps } from '../types';
import { FieldWrapper, getInputClasses } from './FieldWrapper';

export const ChoiceField: React.FC<FieldComponentProps<string>> = ({
  field,
  value,
  onChange,
  disabled,
  readOnly,
  error,
}) => {
  const choices = field.config?.choices || [];

  return (
    <FieldWrapper
      label={field.label}
      required={field.config?.validators?.required}
      error={error}
      helpText={field.config?.helpText}
    >
      <div className="relative">
        <select
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled || readOnly}
          className={`${getInputClasses({ error, readOnly, disabled })} appearance-none pr-10 cursor-pointer`}
        >
          <option value="">Select an option...</option>
          {choices.map((choice: any) => (
            <option key={choice.value} value={choice.value}>
              {choice.label}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none text-muted-foreground" aria-hidden="true" />
      </div>
    </FieldWrapper>
  );
};
