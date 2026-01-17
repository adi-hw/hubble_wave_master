import React, { useMemo } from 'react';
import { FieldComponentProps } from '../types';
import { FieldWrapper } from './FieldWrapper';

interface RollupConfig {
  sourceCollection?: string;
  referenceProperty?: string;
  sourceProperty?: string;
  aggregation?: 'SUM' | 'AVG' | 'COUNT' | 'COUNTA' | 'COUNTALL' | 'MIN' | 'MAX' | 'FIRST' | 'LAST' | 'CONCAT' | 'CONCAT_UNIQUE';
  filter?: string;
}

const AGGREGATION_ICONS: Record<string, string> = {
  SUM: 'Σ',
  AVG: 'x̄',
  COUNT: '#',
  COUNTA: '#',
  COUNTALL: '#',
  MIN: '↓',
  MAX: '↑',
  FIRST: '1st',
  LAST: 'last',
  CONCAT: '⊕',
  CONCAT_UNIQUE: '⊕!',
};

const AGGREGATION_LABELS: Record<string, string> = {
  SUM: 'Sum',
  AVG: 'Average',
  COUNT: 'Count (numeric)',
  COUNTA: 'Count (non-empty)',
  COUNTALL: 'Count (all)',
  MIN: 'Minimum',
  MAX: 'Maximum',
  FIRST: 'First value',
  LAST: 'Last value',
  CONCAT: 'Concatenate',
  CONCAT_UNIQUE: 'Concatenate (unique)',
};

/**
 * RollupField - Displays aggregated values from related records
 *
 * Rollup fields are read-only and display aggregated data from a related collection.
 */
export const RollupField: React.FC<FieldComponentProps<unknown>> = ({
  field,
  value,
  error,
}) => {
  const config = field.config as RollupConfig | undefined;
  const aggregation = config?.aggregation ?? 'COUNT';

  // Format the display value based on aggregation type
  const displayValue = useMemo(() => {
    if (value === null || value === undefined) {
      return <span className="text-muted-foreground">No data</span>;
    }

    // Number aggregations
    if (['SUM', 'AVG', 'MIN', 'MAX'].includes(aggregation)) {
      const numVal = typeof value === 'number' ? value : parseFloat(String(value));
      if (isNaN(numVal)) return String(value);
      return numVal.toLocaleString(undefined, {
        maximumFractionDigits: aggregation === 'AVG' ? 2 : 0,
      });
    }

    // Count aggregations
    if (['COUNT', 'COUNTA', 'COUNTALL'].includes(aggregation)) {
      const countVal = typeof value === 'number' ? value : parseInt(String(value), 10);
      if (isNaN(countVal)) return String(value);
      return (
        <span className="font-medium">
          {countVal.toLocaleString()} {countVal === 1 ? 'record' : 'records'}
        </span>
      );
    }

    // String aggregations
    return String(value);
  }, [value, aggregation]);

  const icon = AGGREGATION_ICONS[aggregation] ?? '#';
  const label = AGGREGATION_LABELS[aggregation] ?? aggregation;

  return (
    <FieldWrapper
      label={field.label}
      required={false}
      error={error}
      helpText={field.config?.helpText}
    >
      <div className="px-3 py-2 rounded-md text-sm bg-muted text-foreground border border-border">
        <div className="flex items-center gap-2">
          <span
            className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded text-xs font-bold bg-info-subtle text-info-text"
            title={label}
          >
            {icon}
          </span>
          <span className="flex-1 truncate">{displayValue}</span>
        </div>
      </div>
      {config?.sourceCollection && config?.sourceProperty && (
        <div className="mt-1 text-xs px-2 py-1 rounded flex items-center gap-1 bg-muted text-muted-foreground">
          <span>{label}</span>
          <span>of</span>
          <span className="font-medium">{config.sourceProperty}</span>
          <span>from</span>
          <span className="font-medium">{config.sourceCollection}</span>
        </div>
      )}
    </FieldWrapper>
  );
};
