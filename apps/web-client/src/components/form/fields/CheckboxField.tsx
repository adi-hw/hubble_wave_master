import React from 'react';
import { Check, AlertCircle, Info } from 'lucide-react';
import { FieldComponentProps } from '../types';

export const CheckboxField: React.FC<FieldComponentProps<unknown>> = ({
  field,
  value,
  onChange,
  disabled,
  readOnly,
  error,
}) => {
  // Convert value to boolean safely, handling various truthy/falsy values
  const isChecked = value === true || value === 'true' || value === 1 || value === '1';

  return (
    <div className="field-wrapper">
      <label
        className={`
          inline-flex items-center gap-3 cursor-pointer group
          ${disabled || readOnly ? 'cursor-not-allowed opacity-60' : ''}
        `}
      >
        {/* Custom checkbox */}
        <div className="relative">
          <input
            type="checkbox"
            checked={isChecked}
            onChange={(e) => onChange(e.target.checked)}
            disabled={disabled || readOnly}
            className="sr-only peer"
          />
          <div
            className={`
              w-5 h-5 rounded border-2 flex items-center justify-center transition-all
              ${
                isChecked
                  ? 'bg-primary-600 border-primary-600'
                  : 'bg-white border-slate-300 group-hover:border-slate-400'
              }
              ${error ? 'border-danger-400' : ''}
              ${disabled || readOnly ? 'opacity-60' : ''}
            `}
          >
            {isChecked && <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />}
          </div>
        </div>

        {/* Label text */}
        <span className="text-sm font-medium text-slate-700 select-none">{field.label}</span>
      </label>

      {/* Error or Help text */}
      {error ? (
        <div className="flex items-start gap-1.5 mt-1.5 ml-8">
          <AlertCircle className="h-3.5 w-3.5 text-danger-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-danger-600">{error}</p>
        </div>
      ) : field.config?.helpText ? (
        <div className="flex items-start gap-1.5 mt-1.5 ml-8">
          <Info className="h-3.5 w-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-slate-500">{field.config.helpText}</p>
        </div>
      ) : null}
    </div>
  );
};
