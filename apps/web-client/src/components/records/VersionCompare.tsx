/**
 * VersionCompare - Version Comparison Component
 *
 * Provides side-by-side comparison of two record versions with:
 * - Visual diff highlighting (added, removed, changed fields)
 * - Color-coded changes (green for added, red for removed, yellow for changed)
 * - Field-level comparison with labels and values
 * - Support for complex data types (objects, arrays, primitives)
 * - Expandable/collapsible sections for nested data
 *
 * Uses HubbleWave design tokens for consistent styling.
 */

import React, { useMemo, useState } from 'react';
import {
  Plus,
  Minus,
  ArrowLeftRight,
  ChevronDown,
  ChevronRight,
  Check,
  X,
  Eye,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { formatDateTime } from '../../lib/utils';
import type { RecordVersion } from './VersionHistory';

export interface VersionCompareProps {
  oldVersion: RecordVersion;
  newVersion: RecordVersion;
  className?: string;
  fieldLabels?: Record<string, string>;
  excludeFields?: string[];
  showMetadata?: boolean;
}

interface FieldChange {
  field: string;
  label: string;
  changeType: 'added' | 'removed' | 'changed' | 'unchanged';
  oldValue: any;
  newValue: any;
  isNested: boolean;
}

const formatValue = (value: any): string => {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (value instanceof Date) return formatDateTime(value);
  if (Array.isArray(value)) return `Array (${value.length} items)`;
  if (typeof value === 'object') return `Object (${Object.keys(value).length} keys)`;
  return String(value);
};

const isComplexValue = (value: any): boolean => {
  return (
    value !== null &&
    value !== undefined &&
    (typeof value === 'object' || Array.isArray(value))
  );
};

const areValuesEqual = (a: any, b: any): boolean => {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (a === undefined || b === undefined) return false;
  if (typeof a !== typeof b) return false;

  if (Array.isArray(a) && Array.isArray(b)) {
    return JSON.stringify(a) === JSON.stringify(b);
  }

  if (typeof a === 'object' && typeof b === 'object') {
    return JSON.stringify(a) === JSON.stringify(b);
  }

  return a === b;
};

type ChangeColors = {
  bgClass: string;
  textClass: string;
  borderClass: string;
  icon: typeof Plus;
};

const getChangeColors = (changeType: FieldChange['changeType']): ChangeColors => {
  switch (changeType) {
    case 'added':
      return {
        bgClass: 'bg-success-subtle',
        textClass: 'text-success-text',
        borderClass: 'border-success-border',
        icon: Plus,
      };
    case 'removed':
      return {
        bgClass: 'bg-danger-subtle',
        textClass: 'text-danger-text',
        borderClass: 'border-danger-border',
        icon: Minus,
      };
    case 'changed':
      return {
        bgClass: 'bg-warning-subtle',
        textClass: 'text-warning-text',
        borderClass: 'border-warning-border',
        icon: ArrowLeftRight,
      };
    default:
      return {
        bgClass: 'bg-muted',
        textClass: 'text-muted-foreground',
        borderClass: 'border-border/60',
        icon: Check,
      };
  }
};

export const VersionCompare: React.FC<VersionCompareProps> = ({
  oldVersion,
  newVersion,
  className = '',
  fieldLabels = {},
  excludeFields = [],
  showMetadata = true,
}) => {
  const [expandedFields, setExpandedFields] = useState<Set<string>>(new Set());

  const changes = useMemo(() => {
    const oldData = oldVersion.data || {};
    const newData = newVersion.data || {};
    const allFields = new Set([
      ...Object.keys(oldData),
      ...Object.keys(newData),
    ]);

    const fieldChanges: FieldChange[] = [];

    for (const field of allFields) {
      if (excludeFields.includes(field)) continue;

      const oldValue = oldData[field];
      const newValue = newData[field];
      const label = fieldLabels[field] || field;

      let changeType: FieldChange['changeType'];
      if (!(field in oldData)) {
        changeType = 'added';
      } else if (!(field in newData)) {
        changeType = 'removed';
      } else if (areValuesEqual(oldValue, newValue)) {
        changeType = 'unchanged';
      } else {
        changeType = 'changed';
      }

      fieldChanges.push({
        field,
        label,
        changeType,
        oldValue,
        newValue,
        isNested: isComplexValue(oldValue) || isComplexValue(newValue),
      });
    }

    return fieldChanges.sort((a, b) => {
      const order = { changed: 0, added: 1, removed: 2, unchanged: 3 };
      return order[a.changeType] - order[b.changeType];
    });
  }, [oldVersion, newVersion, fieldLabels, excludeFields]);

  const stats = useMemo(() => {
    const added = changes.filter((c) => c.changeType === 'added').length;
    const removed = changes.filter((c) => c.changeType === 'removed').length;
    const changed = changes.filter((c) => c.changeType === 'changed').length;
    const unchanged = changes.filter((c) => c.changeType === 'unchanged').length;

    return { added, removed, changed, unchanged, total: changes.length };
  }, [changes]);

  const toggleExpanded = (field: string) => {
    const newExpanded = new Set(expandedFields);
    if (newExpanded.has(field)) {
      newExpanded.delete(field);
    } else {
      newExpanded.add(field);
    }
    setExpandedFields(newExpanded);
  };

  const renderValue = (value: any, changeType: FieldChange['changeType'], field: string) => {
    const isExpanded = expandedFields.has(field);
    const colors = getChangeColors(changeType);

    if (isComplexValue(value)) {
      return (
        <div>
          <button
            onClick={() => toggleExpanded(field)}
            className="flex items-center gap-2 text-sm font-mono mb-2 p-2 -m-2 rounded-lg transition-colors min-h-[44px] text-muted-foreground hover:bg-hover"
            aria-label={isExpanded ? 'Collapse value' : 'Expand value'}
            aria-expanded={isExpanded}
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
            {formatValue(value)}
          </button>
          {isExpanded && (
            <pre
              className={cn(
                'text-xs p-3 rounded-lg overflow-auto font-mono max-h-[300px]',
                'bg-muted text-muted-foreground border',
                colors.borderClass
              )}
            >
              {JSON.stringify(value, null, 2)}
            </pre>
          )}
        </div>
      );
    }

    return (
      <span className="text-sm break-words font-mono text-foreground">
        {formatValue(value)}
      </span>
    );
  };

  return (
    <div className={cn('space-y-6', className)}>
      {/* Metadata Header */}
      {showMetadata && (
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 rounded-lg bg-danger-subtle border border-danger-border">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-8 w-8 rounded-lg flex items-center justify-center text-sm font-semibold bg-danger text-danger-foreground">
                v{oldVersion.version}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-foreground">
                  Previous Version
                </h3>
              </div>
            </div>
            <div className="space-y-1 text-xs text-muted-foreground">
              <p>{oldVersion.userName}</p>
              <p>{formatDateTime(oldVersion.timestamp)}</p>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-success-subtle border border-success-border">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-8 w-8 rounded-lg flex items-center justify-center text-sm font-semibold bg-success text-success-foreground">
                v{newVersion.version}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-foreground">
                  Current Version
                </h3>
              </div>
            </div>
            <div className="space-y-1 text-xs text-muted-foreground">
              <p>{newVersion.userName}</p>
              <p>{formatDateTime(newVersion.timestamp)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Stats Bar */}
      <div className="flex items-center justify-between p-4 rounded-lg bg-muted border border-border">
        <h3 className="text-sm font-semibold text-foreground">
          Field Changes
        </h3>
        <div className="flex items-center gap-4 text-xs">
          {stats.added > 0 && (
            <div className="flex items-center gap-1.5">
              <Plus className="h-3.5 w-3.5 text-success-text" />
              <span className="text-muted-foreground">
                {stats.added} added
              </span>
            </div>
          )}
          {stats.removed > 0 && (
            <div className="flex items-center gap-1.5">
              <Minus className="h-3.5 w-3.5 text-danger-text" />
              <span className="text-muted-foreground">
                {stats.removed} removed
              </span>
            </div>
          )}
          {stats.changed > 0 && (
            <div className="flex items-center gap-1.5">
              <ArrowLeftRight className="h-3.5 w-3.5 text-warning-text" />
              <span className="text-muted-foreground">
                {stats.changed} changed
              </span>
            </div>
          )}
          {stats.unchanged > 0 && (
            <div className="flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">
                {stats.unchanged} unchanged
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Field Comparison */}
      {changes.length === 0 ? (
        <div className="p-8 rounded-lg text-center bg-muted border border-border">
          <Eye className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No fields to compare
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {changes.map((change) => {
            const colors = getChangeColors(change.changeType);
            const Icon = colors.icon;

            return (
              <div
                key={change.field}
                className={cn(
                  'rounded-lg overflow-hidden border',
                  colors.bgClass,
                  colors.borderClass
                )}
              >
                {/* Field Header */}
                <div
                  className={cn(
                    'px-4 py-3 flex items-center justify-between border-b',
                    colors.borderClass
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        'h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-card',
                        colors.textClass
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className={cn('text-sm font-semibold', colors.textClass)}>
                        {change.label}
                      </h4>
                      <p className="text-xs font-mono text-muted-foreground">
                        {change.field}
                      </p>
                    </div>
                  </div>
                  <span
                    className={cn(
                      'text-xs font-medium px-2.5 py-1 rounded-full bg-card',
                      colors.textClass
                    )}
                  >
                    {change.changeType}
                  </span>
                </div>

                {/* Field Values Comparison */}
                <div
                  className={cn(
                    'grid grid-cols-2 divide-x',
                    colors.borderClass.replace('border-', 'divide-')
                  )}
                >
                  {/* Old Value */}
                  <div className="p-4">
                    <label className="text-xs font-medium uppercase tracking-wider mb-2 block text-muted-foreground">
                      Previous Value
                    </label>
                    {change.changeType === 'added' ? (
                      <div className="flex items-center gap-2 text-sm italic">
                        <X className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">
                          Not present
                        </span>
                      </div>
                    ) : (
                      <div
                        className={cn(
                          'p-3 rounded-lg bg-card border',
                          colors.borderClass,
                          change.changeType === 'removed' && 'line-through opacity-60'
                        )}
                      >
                        {renderValue(change.oldValue, change.changeType, `old-${change.field}`)}
                      </div>
                    )}
                  </div>

                  {/* New Value */}
                  <div className="p-4">
                    <label className="text-xs font-medium uppercase tracking-wider mb-2 block text-muted-foreground">
                      Current Value
                    </label>
                    {change.changeType === 'removed' ? (
                      <div className="flex items-center gap-2 text-sm italic">
                        <X className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">
                          Removed
                        </span>
                      </div>
                    ) : (
                      <div
                        className={cn(
                          'p-3 rounded-lg bg-card border',
                          colors.borderClass,
                          change.changeType === 'added' && 'font-medium'
                        )}
                      >
                        {renderValue(change.newValue, change.changeType, `new-${change.field}`)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* No Changes Message */}
      {stats.added === 0 && stats.removed === 0 && stats.changed === 0 && (
        <div className="p-6 rounded-lg text-center bg-info-subtle border border-info-border">
          <div className="flex items-center justify-center gap-3 mb-2">
            <Check className="h-6 w-6 text-info-text" />
            <h3 className="text-sm font-semibold text-info-text">
              Versions are identical
            </h3>
          </div>
          <p className="text-sm text-muted-foreground">
            No differences detected between version {oldVersion.version} and version {newVersion.version}
          </p>
        </div>
      )}
    </div>
  );
};

export default VersionCompare;
