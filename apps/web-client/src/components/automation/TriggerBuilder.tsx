/**
 * TriggerBuilder Component
 * HubbleWave Platform - Phase 3
 *
 * Visual trigger configuration for automation rules.
 */

import React, { useState } from 'react';
import { X, ChevronDown } from 'lucide-react';

export type TriggerTiming = 'before' | 'after' | 'async';
export type TriggerOperation = 'insert' | 'update' | 'delete';

interface TriggerBuilderProps {
  timing: TriggerTiming;
  operations: TriggerOperation[];
  watchProperties?: string[];
  collectionName: string;
  properties: Array<{ code: string; label: string; type: string }>;
  onTimingChange: (timing: TriggerTiming) => void;
  onOperationsChange: (operations: TriggerOperation[]) => void;
  onWatchPropertiesChange: (properties: string[] | undefined) => void;
}

const OPERATIONS: { value: TriggerOperation; label: string }[] = [
  { value: 'insert', label: 'Created' },
  { value: 'update', label: 'Updated' },
  { value: 'delete', label: 'Deleted' },
];

export const TriggerBuilder: React.FC<TriggerBuilderProps> = ({
  timing,
  operations,
  watchProperties,
  collectionName,
  properties,
  onTimingChange,
  onOperationsChange,
  onWatchPropertiesChange,
}) => {
  const [propertyDropdownOpen, setPropertyDropdownOpen] = useState(false);

  const handleOperationToggle = (op: TriggerOperation) => {
    if (operations.includes(op)) {
      onOperationsChange(operations.filter((o) => o !== op));
    } else {
      onOperationsChange([...operations, op]);
    }
  };

  const handlePropertyToggle = (propertyCode: string) => {
    const current = watchProperties ?? [];
    if (current.includes(propertyCode)) {
      const newList = current.filter((p) => p !== propertyCode);
      onWatchPropertiesChange(newList.length > 0 ? newList : undefined);
    } else {
      onWatchPropertiesChange([...current, propertyCode]);
    }
  };

  const handleRemoveProperty = (propertyCode: string) => {
    const current = watchProperties ?? [];
    const newList = current.filter((p) => p !== propertyCode);
    onWatchPropertiesChange(newList.length > 0 ? newList : undefined);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Trigger Sentence */}
      <div className="flex flex-wrap items-center gap-3 p-4 rounded border bg-card border-border">
        <span className="text-base text-foreground">
          When a record is
        </span>

        {/* Operations Selection */}
        <div className="flex gap-2">
          {OPERATIONS.map((op) => {
            const isSelected = operations.includes(op.value);
            return (
              <button
                key={op.value}
                type="button"
                onClick={() => handleOperationToggle(op.value)}
                className={`px-3 py-1 text-sm rounded-full border cursor-pointer transition-colors ${
                  isSelected
                    ? 'bg-primary border-primary text-primary-foreground'
                    : 'bg-transparent border-border text-foreground hover:bg-muted'
                }`}
                role="checkbox"
                aria-checked={isSelected}
              >
                {op.label}
              </button>
            );
          })}
        </div>

        {/* Timing Selection */}
        <div className="min-w-[140px]">
          <label className="block text-xs font-medium mb-1 text-muted-foreground">
            Timing
          </label>
          <select
            value={timing}
            onChange={(e) => onTimingChange(e.target.value as TriggerTiming)}
            className="w-full px-3 py-1.5 text-sm rounded border focus:outline-none focus:ring-2 bg-card border-border text-foreground"
          >
            <option value="before">Before save</option>
            <option value="after">After save</option>
            <option value="async">Async (background)</option>
          </select>
        </div>
      </div>

      {/* Collection Label */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">
          on collection:
        </span>
        <span className="px-2 py-0.5 text-sm font-medium rounded bg-muted text-foreground">
          {collectionName}
        </span>
      </div>

      {/* Watch Properties (for update triggers) */}
      {operations.includes('update') && (
        <div>
          <p className="mb-2 text-sm text-muted-foreground">
            Only trigger when these properties change (optional):
          </p>

          {/* Selected Properties */}
          {watchProperties && watchProperties.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {watchProperties.map((code) => {
                const prop = properties.find((p) => p.code === code);
                return (
                  <span
                    key={code}
                    className="inline-flex items-center gap-1 px-2 py-0.5 text-sm rounded bg-primary/10 text-primary"
                  >
                    {prop?.label ?? code}
                    <button
                      type="button"
                      onClick={() => handleRemoveProperty(code)}
                      className="p-0.5 rounded hover:bg-hover"
                      aria-label={`Remove ${prop?.label ?? code}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                );
              })}
            </div>
          )}

          {/* Property Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setPropertyDropdownOpen(!propertyDropdownOpen)}
              className={`w-full flex items-center justify-between px-3 py-1.5 text-sm rounded border focus:outline-none focus:ring-2 bg-card border-border ${
                watchProperties?.length ? 'text-foreground' : 'text-muted-foreground'
              }`}
            >
              <span>
                {watchProperties?.length ? `${watchProperties.length} selected` : 'All properties (default)'}
              </span>
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            </button>

            {propertyDropdownOpen && (
              <div className="absolute z-10 w-full mt-1 max-h-[200px] overflow-y-auto rounded border shadow-lg bg-card border-border">
                {properties.map((prop) => {
                  const isSelected = watchProperties?.includes(prop.code) ?? false;
                  return (
                    <button
                      key={prop.code}
                      type="button"
                      onClick={() => handlePropertyToggle(prop.code)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-muted text-foreground"
                    >
                      <span
                        className={`inline-flex items-center justify-center w-4 h-4 rounded border ${
                          isSelected
                            ? 'bg-primary border-primary'
                            : 'bg-transparent border-border'
                        }`}
                      >
                        {isSelected && (
                          <svg
                            className="w-3 h-3 text-primary-foreground"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={3}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        )}
                      </span>
                      {prop.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Click outside to close */}
          {propertyDropdownOpen && (
            <div
              className="fixed inset-0 z-0"
              onClick={() => setPropertyDropdownOpen(false)}
            />
          )}
        </div>
      )}
    </div>
  );
};
