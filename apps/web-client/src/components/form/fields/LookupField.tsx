import React from 'react';
import { FieldComponentProps } from '../types';
import { FieldWrapper } from './FieldWrapper';

interface LookupConfig {
  sourceCollection?: string;
  referenceProperty?: string;
  sourceProperty?: string;
  cache?: boolean;
}

/**
 * LookupField - Displays values from related records
 *
 * Lookup fields are read-only and display data fetched from a referenced record.
 */
export const LookupField: React.FC<FieldComponentProps<unknown>> = ({
  field,
  value,
  error,
}) => {
  const config = field.config as LookupConfig | undefined;

  // Format the display value
  const displayValue = () => {
    if (value === null || value === undefined) {
      return <span className="text-muted-foreground">No linked record</span>;
    }

    // Handle array values (from multi-reference lookups)
    if (Array.isArray(value)) {
      if (value.length === 0) {
        return <span className="text-muted-foreground">No linked records</span>;
      }
      return (
        <div className="flex flex-wrap gap-1">
          {value.map((v, i) => (
            <span
              key={i}
              className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-primary text-primary-foreground"
            >
              {String(v)}
            </span>
          ))}
        </div>
      );
    }

    // Handle object values
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }

    return String(value);
  };

  return (
    <FieldWrapper
      label={field.label}
      required={false}
      error={error}
      helpText={field.config?.helpText}
    >
      <div className="px-3 py-2 rounded-md text-sm bg-muted text-foreground border border-border">
        <div className="flex items-center gap-2">
          <span className="flex-shrink-0" title="Lookup field">
            <svg
              className="w-4 h-4 text-info-text"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
              />
            </svg>
          </span>
          <span className="flex-1">{displayValue()}</span>
        </div>
      </div>
      {config?.sourceCollection && config?.sourceProperty && (
        <div className="mt-1 text-xs px-2 py-1 rounded flex items-center gap-1 bg-muted text-muted-foreground">
          <span className="font-medium">{config.sourceProperty}</span>
          <span>from</span>
          <span className="font-medium">{config.sourceCollection}</span>
          <span>via</span>
          <span className="font-medium">{config.referenceProperty}</span>
        </div>
      )}
    </FieldWrapper>
  );
};
