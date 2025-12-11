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
    <div className="border-b border-slate-200 bg-slate-50/70 px-4 py-2 flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Filters
        </span>
        {ruleChips.map((chip) => (
          <button
            key={chip.key}
            type="button"
            className="inline-flex items-center gap-1 rounded-full bg-slate-100 border border-slate-200 px-2.5 py-1 text-[11px] text-slate-700 hover:bg-slate-200"
            onClick={() => onClearRule(chip.index)}
          >
            <span className="truncate max-w-[200px] text-left">
              {chip.label}
            </span>
            <X className="h-3 w-3 text-slate-400" />
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={onClearAll}
        className="text-[11px] text-slate-500 hover:text-slate-700"
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
