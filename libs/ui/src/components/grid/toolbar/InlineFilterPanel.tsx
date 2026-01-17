/**
 * InlineFilterPanel - Inline version of AdvancedFilterBuilder
 *
 * Displays filter builder as an inline expandable panel instead of a modal.
 * Renders between the toolbar and the grid header.
 */

import { useCallback, useMemo, useState, useRef, useEffect } from 'react';
import { Table } from '@tanstack/react-table';
import { cn } from '../utils/cn';
import type { GridRowData, GridColumnType } from '../types';

// =============================================================================
// TYPES (shared with AdvancedFilterBuilder)
// =============================================================================

export type LogicalOperator = 'AND' | 'OR' | 'XOR' | 'NAND' | 'NOR';

export type FilterOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'starts_with'
  | 'ends_with'
  | 'matches_regex'
  | 'is_empty'
  | 'is_not_empty'
  | 'greater_than'
  | 'greater_than_or_equal'
  | 'less_than'
  | 'less_than_or_equal'
  | 'between'
  | 'not_between'
  | 'before'
  | 'after'
  | 'on_date'
  | 'not_on_date'
  | 'in_last'
  | 'in_next'
  | 'today'
  | 'yesterday'
  | 'this_week'
  | 'last_week'
  | 'this_month'
  | 'last_month'
  | 'this_year'
  | 'in_list'
  | 'not_in_list'
  | 'has_any'
  | 'has_all'
  | 'has_none'
  | 'is_true'
  | 'is_false';

export interface FilterCondition {
  id: string;
  columnId: string;
  operator: FilterOperator;
  value: unknown;
  value2?: unknown;
  unit?: 'days' | 'weeks' | 'months' | 'years';
}

export interface FilterGroup {
  id: string;
  type: 'group';
  operator: LogicalOperator;
  conditions: (FilterCondition | FilterGroup)[];
  isNegated?: boolean;
}

export interface FilterState {
  rootGroup: FilterGroup;
  isActive: boolean;
}

interface InlineFilterPanelProps<TData extends GridRowData> {
  table: Table<TData>;
  isOpen: boolean;
  onClose: () => void;
  onApply: (filter: FilterState) => void;
  initialFilter?: FilterState;
}

interface ColumnInfo {
  id: string;
  label: string;
  type: GridColumnType;
}

// =============================================================================
// OPERATOR DEFINITIONS BY TYPE
// =============================================================================

interface OperatorDef {
  value: FilterOperator;
  label: string;
  requiresValue: boolean;
  requiresSecondValue?: boolean;
  valueType?: 'text' | 'number' | 'date' | 'list' | 'duration';
}

const TEXT_OPERATORS: OperatorDef[] = [
  { value: 'equals', label: 'equals', requiresValue: true },
  { value: 'not_equals', label: 'does not equal', requiresValue: true },
  { value: 'contains', label: 'contains', requiresValue: true },
  { value: 'not_contains', label: 'does not contain', requiresValue: true },
  { value: 'starts_with', label: 'starts with', requiresValue: true },
  { value: 'ends_with', label: 'ends with', requiresValue: true },
  { value: 'is_empty', label: 'is empty', requiresValue: false },
  { value: 'is_not_empty', label: 'is not empty', requiresValue: false },
];

const NUMBER_OPERATORS: OperatorDef[] = [
  { value: 'equals', label: '=', requiresValue: true, valueType: 'number' },
  { value: 'not_equals', label: '≠', requiresValue: true, valueType: 'number' },
  { value: 'greater_than', label: '>', requiresValue: true, valueType: 'number' },
  { value: 'greater_than_or_equal', label: '≥', requiresValue: true, valueType: 'number' },
  { value: 'less_than', label: '<', requiresValue: true, valueType: 'number' },
  { value: 'less_than_or_equal', label: '≤', requiresValue: true, valueType: 'number' },
  { value: 'between', label: 'between', requiresValue: true, requiresSecondValue: true, valueType: 'number' },
  { value: 'is_empty', label: 'is empty', requiresValue: false },
  { value: 'is_not_empty', label: 'is not empty', requiresValue: false },
];

const DATE_OPERATORS: OperatorDef[] = [
  { value: 'on_date', label: 'is on', requiresValue: true, valueType: 'date' },
  { value: 'before', label: 'is before', requiresValue: true, valueType: 'date' },
  { value: 'after', label: 'is after', requiresValue: true, valueType: 'date' },
  { value: 'between', label: 'is between', requiresValue: true, requiresSecondValue: true, valueType: 'date' },
  { value: 'today', label: 'is today', requiresValue: false },
  { value: 'yesterday', label: 'is yesterday', requiresValue: false },
  { value: 'this_week', label: 'this week', requiresValue: false },
  { value: 'this_month', label: 'this month', requiresValue: false },
  { value: 'is_empty', label: 'is empty', requiresValue: false },
];

const BOOLEAN_OPERATORS: OperatorDef[] = [
  { value: 'is_true', label: 'is true', requiresValue: false },
  { value: 'is_false', label: 'is false', requiresValue: false },
];

const LIST_OPERATORS: OperatorDef[] = [
  { value: 'in_list', label: 'is any of', requiresValue: true, valueType: 'list' },
  { value: 'not_in_list', label: 'is none of', requiresValue: true, valueType: 'list' },
  { value: 'is_empty', label: 'is empty', requiresValue: false },
];

const getOperatorsForType = (type: GridColumnType): OperatorDef[] => {
  switch (type) {
    case 'number':
    case 'currency':
    case 'percent':
    case 'progress':
      return NUMBER_OPERATORS;
    case 'date':
    case 'datetime':
    case 'time':
      return DATE_OPERATORS;
    case 'boolean':
      return BOOLEAN_OPERATORS;
    case 'tags':
    case 'status':
    case 'priority':
      return LIST_OPERATORS;
    default:
      return TEXT_OPERATORS;
  }
};

// =============================================================================
// ICONS
// =============================================================================

const PlusIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M8 3V13M3 8H13" strokeLinecap="round" />
  </svg>
);

const TrashIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
    <path d="M5.5 5.5A.5.5 0 016 6v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm2.5 0a.5.5 0 01.5.5v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm3 .5a.5.5 0 00-1 0v6a.5.5 0 001 0V6z" />
    <path fillRule="evenodd" d="M14.5 3a1 1 0 01-1 1H13v9a2 2 0 01-2 2H5a2 2 0 01-2-2V4h-.5a1 1 0 01-1-1V2a1 1 0 011-1H6a1 1 0 011-1h2a1 1 0 011 1h3.5a1 1 0 011 1v1zM4.118 4L4 4.059V13a1 1 0 001 1h6a1 1 0 001-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z" />
  </svg>
);

const ChevronUpIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M4 10L8 6L12 10" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// =============================================================================
// LOGICAL OPERATOR BADGE
// =============================================================================

interface LogicalOperatorBadgeProps {
  operator: LogicalOperator;
  onChange: (operator: LogicalOperator) => void;
}

function LogicalOperatorBadge({ operator, onChange }: LogicalOperatorBadgeProps) {
  const operators: LogicalOperator[] = ['AND', 'OR', 'XOR', 'NAND', 'NOR'];
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const colors: Record<LogicalOperator, string> = {
    AND: 'var(--color-success-500)',
    OR: 'var(--color-info-500)',
    XOR: 'var(--color-primary-500)',
    NAND: 'var(--color-warning-500)',
    NOR: 'var(--color-danger-500)',
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="px-2 py-1 rounded text-xs font-bold transition-colors"
        style={{
          backgroundColor: `color-mix(in srgb, ${colors[operator]} 18%, transparent)`,
          color: colors[operator],
          border: `1px solid color-mix(in srgb, ${colors[operator]} 35%, transparent)`,
        }}
      >
        {operator}
      </button>
      {isOpen && (
        <div
          className="absolute top-full left-0 mt-1 rounded-lg overflow-hidden shadow-lg z-10"
          style={{
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-default)',
          }}
        >
          {operators.map((op) => (
            <button
              key={op}
              onClick={() => {
                onChange(op);
                setIsOpen(false);
              }}
              className={cn(
                'block w-full px-3 py-1.5 text-xs font-bold text-left transition-colors',
                op === operator && 'bg-[var(--bg-hover)]'
              )}
              style={{ color: colors[op] }}
            >
              {op}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// FILTER CONDITION COMPONENT
// =============================================================================

interface FilterConditionComponentProps {
  condition: FilterCondition;
  columns: ColumnInfo[];
  onUpdate: (condition: FilterCondition) => void;
  onRemove: () => void;
}

function FilterConditionComponent({
  condition,
  columns,
  onUpdate,
  onRemove,
}: FilterConditionComponentProps) {
  const selectedColumn = columns.find((c) => c.id === condition.columnId);
  const operators = selectedColumn ? getOperatorsForType(selectedColumn.type) : TEXT_OPERATORS;
  const selectedOperator = operators.find((op) => op.value === condition.operator);

  return (
    <div
      className="flex items-center gap-2 p-2 rounded-lg"
      style={{ backgroundColor: 'var(--bg-surface-secondary)' }}
    >
      {/* Column selector */}
      <select
        value={condition.columnId}
        onChange={(e) =>
          onUpdate({
            ...condition,
            columnId: e.target.value,
            operator: 'contains',
            value: '',
          })
        }
        className="px-2 py-1.5 rounded text-sm bg-transparent border outline-none min-w-[120px]"
        style={{
          borderColor: 'var(--border-default)',
          color: 'var(--text-primary)',
        }}
      >
        <option value="">Select column...</option>
        {columns.map((col) => (
          <option key={col.id} value={col.id}>
            {col.label}
          </option>
        ))}
      </select>

      {/* Operator selector */}
      <select
        value={condition.operator}
        onChange={(e) => onUpdate({ ...condition, operator: e.target.value as FilterOperator })}
        className="px-2 py-1.5 rounded text-sm bg-transparent border outline-none min-w-[100px]"
        style={{
          borderColor: 'var(--border-default)',
          color: 'var(--text-primary)',
        }}
        disabled={!condition.columnId}
      >
        {operators.map((op) => (
          <option key={op.value} value={op.value}>
            {op.label}
          </option>
        ))}
      </select>

      {/* Value input */}
      {selectedOperator?.requiresValue && (
        <input
          type={selectedOperator.valueType === 'number' ? 'number' : 'text'}
          value={String(condition.value ?? '')}
          onChange={(e) => onUpdate({ ...condition, value: e.target.value })}
          placeholder="Enter value..."
          className="flex-1 px-2 py-1.5 rounded text-sm bg-transparent border outline-none min-w-[100px]"
          style={{
            borderColor: 'var(--border-default)',
            color: 'var(--text-primary)',
          }}
        />
      )}

      {/* Second value for between operators */}
      {selectedOperator?.requiresSecondValue && (
        <>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            and
          </span>
          <input
            type={selectedOperator.valueType === 'number' ? 'number' : 'text'}
            value={String(condition.value2 ?? '')}
            onChange={(e) => onUpdate({ ...condition, value2: e.target.value })}
            placeholder="End value..."
            className="px-2 py-1.5 rounded text-sm bg-transparent border outline-none min-w-[80px]"
            style={{
              borderColor: 'var(--border-default)',
              color: 'var(--text-primary)',
            }}
          />
        </>
      )}

      {/* Remove button */}
      <button
        onClick={onRemove}
        className="p-1 rounded transition-colors hover:bg-[var(--bg-hover)]"
        style={{ color: 'var(--text-muted)' }}
        title="Remove condition"
      >
        <TrashIcon />
      </button>
    </div>
  );
}

// =============================================================================
// FILTER GROUP COMPONENT
// =============================================================================

interface FilterGroupComponentProps {
  group: FilterGroup;
  columns: ColumnInfo[];
  onUpdate: (group: FilterGroup) => void;
  isRoot?: boolean;
  onRemove?: () => void;
}

function FilterGroupComponent({
  group,
  columns,
  onUpdate,
  isRoot = false,
  onRemove,
}: FilterGroupComponentProps) {
  const addCondition = useCallback(() => {
    const newCondition: FilterCondition = {
      id: `cond-${Date.now()}`,
      columnId: '',
      operator: 'contains',
      value: '',
    };
    onUpdate({
      ...group,
      conditions: [...group.conditions, newCondition],
    });
  }, [group, onUpdate]);

  const addGroup = useCallback(() => {
    const newGroup: FilterGroup = {
      id: `group-${Date.now()}`,
      type: 'group',
      operator: 'AND',
      conditions: [],
    };
    onUpdate({
      ...group,
      conditions: [...group.conditions, newGroup],
    });
  }, [group, onUpdate]);

  const updateCondition = useCallback(
    (index: number, updated: FilterCondition | FilterGroup) => {
      const newConditions = [...group.conditions];
      newConditions[index] = updated;
      onUpdate({ ...group, conditions: newConditions });
    },
    [group, onUpdate]
  );

  const removeCondition = useCallback(
    (index: number) => {
      const newConditions = group.conditions.filter((_, i) => i !== index);
      onUpdate({ ...group, conditions: newConditions });
    },
    [group, onUpdate]
  );

  return (
    <div
      className={cn('rounded-lg', !isRoot && 'p-3 ml-4')}
      style={!isRoot ? { backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' } : undefined}
    >
      {!isRoot && (
        <div className="flex items-center justify-between mb-2">
          <LogicalOperatorBadge
            operator={group.operator}
            onChange={(op) => onUpdate({ ...group, operator: op })}
          />
          <button
            onClick={onRemove}
            className="p-1 rounded transition-colors hover:bg-[var(--bg-hover)]"
            style={{ color: 'var(--text-muted)' }}
            title="Remove group"
          >
            <TrashIcon />
          </button>
        </div>
      )}

      <div className="space-y-2">
        {group.conditions.map((item, index) => (
          <div key={'id' in item ? item.id : index} className="flex items-start gap-2">
            {index > 0 && (
              <div className="flex-shrink-0 pt-2">
                <LogicalOperatorBadge
                  operator={group.operator}
                  onChange={(op) => onUpdate({ ...group, operator: op })}
                />
              </div>
            )}
            <div className="flex-1">
              {'type' in item && item.type === 'group' ? (
                <FilterGroupComponent
                  group={item}
                  columns={columns}
                  onUpdate={(updated) => updateCondition(index, updated)}
                  onRemove={() => removeCondition(index)}
                />
              ) : (
                <FilterConditionComponent
                  condition={item as FilterCondition}
                  columns={columns}
                  onUpdate={(updated) => updateCondition(index, updated)}
                  onRemove={() => removeCondition(index)}
                />
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Add buttons */}
      <div className="flex items-center gap-2 mt-3">
        <button
          onClick={addCondition}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors hover:bg-[var(--bg-hover)]"
          style={{
            backgroundColor: 'var(--bg-surface-secondary)',
            color: 'var(--text-secondary)',
          }}
        >
          <PlusIcon />
          Add Condition
        </button>
        <button
          onClick={addGroup}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors hover:bg-[var(--bg-hover)]"
          style={{
            backgroundColor: 'var(--bg-surface-secondary)',
            color: 'var(--text-secondary)',
          }}
        >
          <PlusIcon />
          Add Group
        </button>
      </div>
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function InlineFilterPanel<TData extends GridRowData>({
  table,
  isOpen,
  onClose,
  onApply,
  initialFilter,
}: InlineFilterPanelProps<TData>) {
  // Get column info from table
  const columns = useMemo<ColumnInfo[]>(() => {
    return table
      .getAllColumns()
      .filter((col) => col.id !== 'select' && col.id !== '_actions' && col.id !== '_view')
      .map((col) => {
        const columnDef = col.columnDef;
        return {
          id: col.id,
          label: typeof columnDef.header === 'string' ? columnDef.header : col.id,
          type: (columnDef.meta as { type?: GridColumnType })?.type || 'text',
        };
      });
  }, [table]);

  // Initialize filter state
  const [filterState, setFilterState] = useState<FilterGroup>(() => {
    if (initialFilter?.rootGroup) {
      return initialFilter.rootGroup;
    }
    return {
      id: 'root',
      type: 'group',
      operator: 'AND',
      conditions: [],
    };
  });

  const handleApply = useCallback(() => {
    onApply({
      rootGroup: filterState,
      isActive: filterState.conditions.length > 0,
    });
  }, [filterState, onApply]);

  const handleClear = useCallback(() => {
    setFilterState({
      id: 'root',
      type: 'group',
      operator: 'AND',
      conditions: [],
    });
  }, []);

  const conditionCount = useMemo(() => {
    const countConditions = (group: FilterGroup): number => {
      return group.conditions.reduce((count, item) => {
        if ('type' in item && item.type === 'group') {
          return count + countConditions(item);
        }
        return count + 1;
      }, 0);
    };
    return countConditions(filterState);
  }, [filterState]);

  if (!isOpen) return null;

  return (
    <div
      className="absolute left-0 right-0 z-30 border-b border-border bg-card shadow-lg overflow-hidden transition-all duration-200"
      style={{ top: 0 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border">
        <div className="flex items-center gap-3">
          <svg
            className="w-4 h-4 text-primary"
            viewBox="0 0 16 16"
            fill="currentColor"
          >
            <path d="M1 2H15L9 8.5V13L7 14V8.5L1 2Z" />
          </svg>
          <span className="text-sm font-medium text-foreground">
            Advanced Filter
          </span>
          {conditionCount > 0 && (
            <span
              className="px-2 py-0.5 rounded-full text-xs bg-primary/10 text-primary"
            >
              {conditionCount} condition{conditionCount > 1 ? 's' : ''}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Root operator */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              Match:
            </span>
            <LogicalOperatorBadge
              operator={filterState.operator}
              onChange={(op) => setFilterState((prev) => ({ ...prev, operator: op }))}
            />
          </div>

          <button
            onClick={onClose}
            className="btn-ghost btn-icon btn-sm"
            title="Collapse filter panel"
          >
            <ChevronUpIcon />
          </button>
        </div>
      </div>

      {/* Filter builder content */}
      <div className="px-4 py-3 max-h-[300px] overflow-y-auto">
        {filterState.conditions.length === 0 ? (
          <div className="flex items-center gap-3 py-4">
            <span className="text-sm text-muted-foreground">
              No filter conditions.
            </span>
            <button
              onClick={() => {
                const newCondition: FilterCondition = {
                  id: `cond-${Date.now()}`,
                  columnId: '',
                  operator: 'contains',
                  value: '',
                };
                setFilterState((prev) => ({
                  ...prev,
                  conditions: [newCondition],
                }));
              }}
              className="btn-primary btn-xs"
            >
              <PlusIcon />
              Add First Condition
            </button>
          </div>
        ) : (
          <FilterGroupComponent
            group={filterState}
            columns={columns}
            onUpdate={setFilterState}
            isRoot
          />
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-border bg-muted">
        <button
          onClick={handleClear}
          disabled={conditionCount === 0}
          className="btn-ghost btn-xs"
        >
          Clear All
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="btn-ghost btn-xs"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            className="btn-primary btn-xs"
          >
            Apply Filter
          </button>
        </div>
      </div>
    </div>
  );
}

export default InlineFilterPanel;
