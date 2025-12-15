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
            className="w-5 h-5 rounded border-2 flex items-center justify-center transition-all"
            style={{
              backgroundColor: isChecked ? 'var(--bg-primary)' : 'var(--bg-surface)',
              borderColor: error
                ? 'var(--border-danger)'
                : isChecked
                  ? 'var(--bg-primary)'
                  : 'var(--border-default)',
              opacity: disabled || readOnly ? 0.6 : 1,
            }}
          >
            {isChecked && <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />}
          </div>
        </div>

        {/* Label text */}
        <span className="text-sm font-medium select-none" style={{ color: 'var(--text-primary)' }}>
          {field.label}
        </span>
      </label>

      {/* Error or Help text */}
      {error ? (
        <div className="flex items-start gap-1.5 mt-1.5 ml-8">
          <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" style={{ color: 'var(--text-danger)' }} />
          <p className="text-xs" style={{ color: 'var(--text-danger)' }}>{error}</p>
        </div>
      ) : field.config?.helpText ? (
        <div className="flex items-start gap-1.5 mt-1.5 ml-8">
          <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" style={{ color: 'var(--text-muted)' }} />
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{field.config.helpText}</p>
        </div>
      ) : null}
    </div>
  );
};
