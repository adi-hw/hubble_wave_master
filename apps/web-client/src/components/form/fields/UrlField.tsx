/**
 * UrlField Component
 * HubbleWave Platform - Phase 1
 *
 * Production-ready URL input with:
 * - Theme-aware styling using CSS variables
 * - WCAG 2.1 AA accessibility compliance
 * - Mobile-friendly touch targets
 */

import React from 'react';
import { Link, ExternalLink } from 'lucide-react';
import type { FieldComponentProps } from '../types';
import { FieldWrapper, getInputClasses } from './FieldWrapper';

/**
 * URL field with a preview link that opens in a new tab.
 */
export const UrlField: React.FC<FieldComponentProps<string>> = ({
  field,
  value,
  onChange,
  disabled,
  readOnly,
  error,
}) => {
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
          aria-describedby={error ? `${field.code}-error` : undefined}
          aria-invalid={!!error}
        />
        <Link
          className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none text-muted-foreground"
          aria-hidden="true"
        />

        {isValid && !disabled && (
          <a
            href={val}
            target="_blank"
            rel="noreferrer"
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md transition-all min-h-[32px] min-w-[32px] flex items-center justify-center text-muted-foreground border border-transparent hover:text-primary hover:bg-accent hover:border-border"
            title="Open link in new tab"
            aria-label={`Open ${val} in new tab`}
          >
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
          </a>
        )}
      </div>
    </FieldWrapper>
  );
};
