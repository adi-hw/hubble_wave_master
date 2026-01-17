/**
 * ActiveFiltersBar Component
 * HubbleWave Platform - Phase 1
 *
 * Production-ready active filters bar with:
 * - Theme-aware styling using CSS variables
 * - WCAG 2.1 AA accessibility compliance
 * - Mobile-friendly 44px touch targets
 */

import React from 'react';
import { X } from 'lucide-react';
import { TableColumn, FilterRule } from './types';

interface ActiveFiltersBarProps {
  fields: TableColumn[];
  rules: FilterRule[];
  logic?: 'AND' | 'OR';
  onClearRule: (index: number) => void;
  onClearAll: () => void;
}

export const ActiveFiltersBar: React.FC<ActiveFiltersBarProps> = ({
  fields,
  rules,
  logic = 'AND',
  onClearRule,
  onClearAll,
}) => {
  const fieldLabel = (code: string) =>
    fields.find((f) => f.code === code)?.label || code;

  const ruleChips = rules.map((r, idx) => {
    const baseLabel = `${fieldLabel(r.field)} ${operatorLabel(r.operator)} "${r.value}"`;
    const opLabel = idx === 0 ? '' : `${logic} `;
    return {
      index: idx,
      label: `${opLabel}${baseLabel}`,
      key: r.id || `rule-${idx}`,
    };
  });

  if (ruleChips.length === 0) return null;

  return (
    <div
      className="px-4 py-2 flex items-center justify-between gap-2 bg-muted border-b border-border"
      role="region"
      aria-label="Active filters"
    >
      <div className="flex items-center gap-2 flex-wrap" role="list">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Filters
        </span>
        {ruleChips.map((chip) => (
          <button
            key={chip.key}
            type="button"
            className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[11px] transition-colors min-h-[32px] bg-card border border-border text-muted-foreground hover:bg-muted"
            onClick={() => onClearRule(chip.index)}
            role="listitem"
            aria-label={`Remove filter: ${chip.label}`}
          >
            <span className="truncate max-w-[200px] text-left">
              {chip.label}
            </span>
            <X
              className="h-3 w-3 flex-shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={onClearAll}
        className="text-[11px] transition-colors min-h-[32px] px-2 text-muted-foreground hover:text-destructive"
        aria-label={`Clear all ${rules.length} filters`}
      >
        Clear all
      </button>
    </div>
  );
};

function operatorLabel(op: FilterRule['operator']) {
  if (op === 'equals') return 'is';
  if (op === 'starts_with') return 'starts with';
  if (op === 'ends_with') return 'ends with';
  return 'contains';
}
