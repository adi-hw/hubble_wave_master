import React from 'react';
import { FieldComponentProps } from '../types';
import { FieldWrapper, getInputClasses } from './FieldWrapper';
import { Network } from 'lucide-react';

export const MacAddressField: React.FC<FieldComponentProps<unknown>> = ({
  field,
  value,
  onChange,
  disabled,
  readOnly,
  error,
}) => {
  // Convert value to string
  const strValue = value == null ? '' : typeof value === 'string' ? value : String(value);

  // MAC address validation pattern (various formats)
  const validateMac = (mac: string) => {
    if (!mac) return true;
    // Normalize by removing separators
    const normalized = mac.replace(/[:\-.\s]/g, '').toUpperCase();
    // Check if it's 12 hex characters
    return /^[0-9A-F]{12}$/.test(normalized);
  };

  // Format MAC address as user types
  const formatMac = (input: string) => {
    // Remove all non-hex characters
    const cleaned = input.replace(/[^0-9A-Fa-f]/g, '').toUpperCase();
    // Split into pairs and join with colons
    const pairs = cleaned.match(/.{1,2}/g) || [];
    return pairs.slice(0, 6).join(':');
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatMac(e.target.value);
    onChange(formatted);
  };

  const isValid = validateMac(strValue);

  return (
    <FieldWrapper
      label={field.label}
      required={field.config?.validators?.required}
      error={error || (!isValid ? 'Invalid MAC address format' : undefined)}
      helpText={field.config?.helpText || 'Enter MAC address (e.g., AA:BB:CC:DD:EE:FF)'}
    >
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
          <Network className="h-4 w-4" />
        </span>
        <input
          type="text"
          value={strValue}
          onChange={handleChange}
          placeholder="AA:BB:CC:DD:EE:FF"
          disabled={disabled}
          readOnly={readOnly}
          maxLength={17}
          className={`${getInputClasses({ error: error || (!isValid ? 'Invalid MAC' : undefined), readOnly, disabled })} pl-10 font-mono uppercase`}
        />
      </div>
    </FieldWrapper>
  );
};
