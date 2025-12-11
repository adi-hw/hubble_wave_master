import React from 'react';
import { FieldComponentProps } from '../types';
import { FieldWrapper, getInputClasses } from './FieldWrapper';

export const DurationField: React.FC<FieldComponentProps<unknown>> = ({
  field,
  value,
  onChange,
  disabled,
  readOnly,
  error,
}) => {
  // Parse duration value (stored as interval string like "2 hours 30 minutes" or ISO 8601 duration)
  const parseDuration = (val: unknown) => {
    if (val === null || val === undefined || val === '') return { hours: '', minutes: '' };

    // Convert to string if it's a number or other type
    const strVal = typeof val === 'string' ? val : String(val);

    // Simple parse for "HH:MM" or numeric hours
    const match = strVal.match(/(\d+):(\d+)/);
    if (match) {
      return { hours: match[1], minutes: match[2] };
    }

    // Try parsing as PostgreSQL interval format like "01:30:00"
    const intervalMatch = strVal.match(/(\d+):(\d+):(\d+)/);
    if (intervalMatch) {
      return { hours: intervalMatch[1], minutes: intervalMatch[2] };
    }

    // Try parsing as total minutes
    const num = parseFloat(strVal);
    if (!isNaN(num)) {
      const hours = Math.floor(num / 60);
      const minutes = Math.round(num % 60);
      return { hours: String(hours), minutes: String(minutes) };
    }
    return { hours: '', minutes: '' };
  };

  const { hours, minutes } = parseDuration(value);

  const handleChange = (h: string, m: string) => {
    const hrs = parseInt(h) || 0;
    const mins = parseInt(m) || 0;
    // Store as "HH:MM" format
    onChange(`${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}`);
  };

  return (
    <FieldWrapper
      label={field.label}
      required={field.config?.validators?.required}
      error={error}
      helpText={field.config?.helpText || 'Enter duration in hours and minutes'}
    >
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1">
          <input
            type="number"
            min="0"
            value={hours}
            onChange={(e) => handleChange(e.target.value, minutes)}
            disabled={disabled}
            readOnly={readOnly}
            placeholder="0"
            className={`${getInputClasses({ error, readOnly, disabled })} w-20 text-center`}
          />
          <span className="text-sm text-slate-500">hrs</span>
        </div>
        <span className="text-slate-400">:</span>
        <div className="flex items-center gap-1">
          <input
            type="number"
            min="0"
            max="59"
            value={minutes}
            onChange={(e) => handleChange(hours, e.target.value)}
            disabled={disabled}
            readOnly={readOnly}
            placeholder="00"
            className={`${getInputClasses({ error, readOnly, disabled })} w-20 text-center`}
          />
          <span className="text-sm text-slate-500">min</span>
        </div>
      </div>
    </FieldWrapper>
  );
};
