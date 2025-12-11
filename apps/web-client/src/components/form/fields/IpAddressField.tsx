import React from 'react';
import { FieldComponentProps } from '../types';
import { FieldWrapper, getInputClasses } from './FieldWrapper';
import { Wifi } from 'lucide-react';

export const IpAddressField: React.FC<FieldComponentProps<unknown>> = ({
  field,
  value,
  onChange,
  disabled,
  readOnly,
  error,
}) => {
  // Convert value to string
  const strValue = value == null ? '' : typeof value === 'string' ? value : String(value);

  // Basic IP validation pattern (IPv4 or IPv6)
  const validateIp = (ip: string) => {
    // IPv4 pattern
    const ipv4Pattern = /^(\d{1,3}\.){3}\d{1,3}$/;
    // IPv6 pattern (simplified)
    const ipv6Pattern = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;
    return ipv4Pattern.test(ip) || ipv6Pattern.test(ip) || ip === '';
  };

  const isValid = !strValue || validateIp(strValue);

  return (
    <FieldWrapper
      label={field.label}
      required={field.config?.validators?.required}
      error={error || (!isValid ? 'Invalid IP address format' : undefined)}
      helpText={field.config?.helpText || 'Enter IPv4 (e.g., 192.168.1.1) or IPv6 address'}
    >
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
          <Wifi className="h-4 w-4" />
        </span>
        <input
          type="text"
          value={strValue}
          onChange={(e) => onChange(e.target.value)}
          placeholder="192.168.1.1"
          disabled={disabled}
          readOnly={readOnly}
          className={`${getInputClasses({ error: error || (!isValid ? 'Invalid IP' : undefined), readOnly, disabled })} pl-10 font-mono`}
        />
      </div>
    </FieldWrapper>
  );
};
