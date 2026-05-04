import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';

export interface ApplicationOption {
  id: string;
  code: string;
  name: string;
  status?: 'draft' | 'published' | 'deprecated';
}

export interface ApplicationPickerProps {
  /** Currently selected Application id, or empty string for "no selection". */
  value: string;
  onChange: (applicationId: string) => void;
  /**
   * The Applications the caller can choose from. Most callers pass
   * the result of `applicationsApi.list()`; the picker doesn't fetch
   * on its own so the same list can be filtered / refreshed by the
   * caller.
   */
  options: ApplicationOption[];
  /** Disabled state — shown as a read-only chip. */
  disabled?: boolean;
  /** Optional render-as-pill mode for compact toolbars. */
  variant?: 'select' | 'pill';
  className?: string;
  placeholder?: string;
}

/**
 * Plan §12.1 — shared Application picker.
 *
 * Used by every builder that creates a new artifact (Collection,
 * Property, View, Form, Process Flow, Automation Rule, Workspace)
 * to scope it under an Application. ADR-6 makes `applicationId` a
 * non-null FK on every metadata entity, so the create dialog flow
 * always renders this picker.
 *
 * Caller controls the list — typically it's the result of
 * `applicationsApi.list()` filtered to active Applications. The
 * picker does NOT fetch on its own so per-page filters and
 * cache reuse stay the caller's concern.
 */
export const ApplicationPicker: React.FC<ApplicationPickerProps> = ({
  value,
  onChange,
  options,
  disabled,
  variant = 'select',
  className,
  placeholder = 'Select Application…',
}) => {
  const sortedOptions = useMemo(
    () => [...options].sort((a, b) => a.name.localeCompare(b.name)),
    [options],
  );

  if (variant === 'pill') {
    const selected = sortedOptions.find((o) => o.id === value);
    return (
      <div
        className={
          className ??
          'inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs'
        }
      >
        <span className="text-muted-foreground">App:</span>
        {selected ? (
          <span className="font-medium text-foreground">{selected.name}</span>
        ) : (
          <span className="text-muted-foreground">{placeholder}</span>
        )}
        <ChevronDown size={10} />
      </div>
    );
  }

  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className={
        className ??
        'rounded border border-border bg-card px-2 py-1 text-sm text-foreground'
      }
    >
      <option value="">{placeholder}</option>
      {sortedOptions.map((opt) => (
        <option key={opt.id} value={opt.id}>
          {opt.name} ({opt.code}
          {opt.status ? ` · ${opt.status}` : ''})
        </option>
      ))}
    </select>
  );
};
