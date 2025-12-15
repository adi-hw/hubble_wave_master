import React from 'react';
import { Link, ExternalLink } from 'lucide-react';
import type { FieldComponentProps } from '../types';
import { FieldWrapper, getInputClasses } from './FieldWrapper';

/**
 * URL field with a preview link that opens in a new tab.
 */
export const UrlField: React.FC<FieldComponentProps<string>> = ({ field, value, onChange, disabled, readOnly, error }) => {
  const val = value ?? '';
  const isValid = typeof val === 'string' && val.trim().length > 0;

  return (
    <FieldWrapper
      label={field.label}
      required={field.config?.validators?.required}
      error={error}
      helpText={field.config?.helpText}
    >
      <div className="relative group">
        <input
          type="url"
          className={`${getInputClasses({ error, readOnly, disabled })} pl-10 pr-9`}
          placeholder={(field as any).placeholder || 'https://example.com'}
          value={val}
          onChange={(e) => onChange?.(e.target.value)}
          disabled={disabled}
          readOnly={readOnly}
        />
        <Link className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
        
        {isValid && !disabled && (
          <a
            href={val}
            target="_blank"
            rel="noreferrer"
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-primary-600 hover:bg-slate-100 rounded-md transition-all border border-transparent hover:border-slate-200"
            title="Open link in new tab"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        )}
      </div>
    </FieldWrapper>
  );
};
