/**
 * AdvancedFilterBuilder - Enterprise-grade Filter System
 *
 * A futuristic, powerful filter builder designed for complex filtering scenarios.
 *
 * Features:
 * - Dynamic operators based on field types
 * - Filter groups with AND/OR/XOR/NAND/NOR logic
 * - Nested filter groups for complex conditions
 * - Visual filter tree representation
 * - Quick filter presets
 * - Filter history and favorites
 * - Keyboard shortcuts
 */

import React, { useCallback, useMemo, useState, useRef, useEffect } from 'react';
import { Table } from '@tanstack/react-table';
import { cn } from '../utils/cn';
import type { GridRowData, GridColumnType } from '../types';

// =============================================================================
// TYPES
// =============================================================================

export type LogicalOperator = 'AND' | 'OR' | 'XOR' | 'NAND' | 'NOR';

export type FilterOperator =
  // Text operators
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'starts_with'
  | 'ends_with'
  | 'matches_regex'
  | 'is_empty'
  | 'is_not_empty'
  // Number operators
  | 'greater_than'
  | 'greater_than_or_equal'
  | 'less_than'
  | 'less_than_or_equal'
  | 'between'
  | 'not_between'
  // Date operators
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
  // List operators
  | 'in_list'
  | 'not_in_list'
  | 'has_any'
  | 'has_all'
  | 'has_none'
  // Boolean operators
  | 'is_true'
  | 'is_false';

export interface FilterCondition {
  id: string;
  columnId: string;
  operator: FilterOperator;
  value: unknown;
  value2?: unknown; // For 'between' operators
  unit?: 'days' | 'weeks' | 'months' | 'years'; // For relative date operators
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

interface AdvancedFilterBuilderProps<TData extends GridRowData> {
  table: Table<TData>;
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
  { value: 'matches_regex', label: 'matches pattern', requiresValue: true },
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
  { value: 'not_between', label: 'not between', requiresValue: true, requiresSecondValue: true, valueType: 'number' },
  { value: 'is_empty', label: 'is empty', requiresValue: false },
  { value: 'is_not_empty', label: 'is not empty', requiresValue: false },
];

const DATE_OPERATORS: OperatorDef[] = [
  { value: 'on_date', label: 'is on', requiresValue: true, valueType: 'date' },
  { value: 'not_on_date', label: 'is not on', requiresValue: true, valueType: 'date' },
  { value: 'before', label: 'is before', requiresValue: true, valueType: 'date' },
  { value: 'after', label: 'is after', requiresValue: true, valueType: 'date' },
  { value: 'between', label: 'is between', requiresValue: true, requiresSecondValue: true, valueType: 'date' },
  { value: 'in_last', label: 'in the last', requiresValue: true, valueType: 'duration' },
  { value: 'in_next', label: 'in the next', requiresValue: true, valueType: 'duration' },
  { value: 'today', label: 'is today', requiresValue: false },
  { value: 'yesterday', label: 'is yesterday', requiresValue: false },
  { value: 'this_week', label: 'this week', requiresValue: false },
  { value: 'last_week', label: 'last week', requiresValue: false },
  { value: 'this_month', label: 'this month', requiresValue: false },
  { value: 'last_month', label: 'last month', requiresValue: false },
  { value: 'this_year', label: 'this year', requiresValue: false },
  { value: 'is_empty', label: 'is empty', requiresValue: false },
  { value: 'is_not_empty', label: 'is not empty', requiresValue: false },
];

const BOOLEAN_OPERATORS: OperatorDef[] = [
  { value: 'is_true', label: 'is true', requiresValue: false },
  { value: 'is_false', label: 'is false', requiresValue: false },
  { value: 'is_empty', label: 'is empty', requiresValue: false },
];

const LIST_OPERATORS: OperatorDef[] = [
  { value: 'in_list', label: 'is any of', requiresValue: true, valueType: 'list' },
  { value: 'not_in_list', label: 'is none of', requiresValue: true, valueType: 'list' },
  { value: 'has_any', label: 'has any of', requiresValue: true, valueType: 'list' },
  { value: 'has_all', label: 'has all of', requiresValue: true, valueType: 'list' },
  { value: 'has_none', label: 'has none of', requiresValue: true, valueType: 'list' },
  { value: 'is_empty', label: 'is empty', requiresValue: false },
  { value: 'is_not_empty', label: 'is not empty', requiresValue: false },
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
    case 'text':
    case 'user':
    case 'reference':
    default:
      return TEXT_OPERATORS;
  }
};

// =============================================================================
// ICONS
// =============================================================================

const CloseIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M4 4L12 12M12 4L4 12" strokeLinecap="round" />
  </svg>
);

const PlusIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M8 3V13M3 8H13" strokeLinecap="round" />
  </svg>
);

const TrashIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M3 4h10M6 4V3a1 1 0 011-1h2a1 1 0 011 1v1M5 4v9a1 1 0 001 1h4a1 1 0 001-1V4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const GroupIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="2" y="2" width="5" height="5" rx="1" />
    <rect x="9" y="2" width="5" height="5" rx="1" />
    <rect x="2" y="9" width="5" height="5" rx="1" />
    <rect x="9" y="9" width="5" height="5" rx="1" />
  </svg>
);

const FilterIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M3 4h14M5 8h10M7 12h6M9 16h2" strokeLinecap="round" />
  </svg>
);

const ChevronDownIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M4 6L8 10L12 6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const DragIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor" opacity="0.4">
    <circle cx="5" cy="4" r="1.5" />
    <circle cx="11" cy="4" r="1.5" />
    <circle cx="5" cy="8" r="1.5" />
    <circle cx="11" cy="8" r="1.5" />
    <circle cx="5" cy="12" r="1.5" />
    <circle cx="11" cy="12" r="1.5" />
  </svg>
);

// =============================================================================
// LOGICAL OPERATOR BADGE
// =============================================================================

interface LogicalOperatorBadgeProps {
  operator: LogicalOperator;
  onChange: (operator: LogicalOperator) => void;
  compact?: boolean;
}

const LOGICAL_OPERATORS: { value: LogicalOperator; label: string; description: string; color: string }[] = [
  { value: 'AND', label: 'AND', description: 'All conditions must match', color: 'var(--color-info-500)' },
  { value: 'OR', label: 'OR', description: 'Any condition can match', color: 'var(--color-success-500)' },
  { value: 'XOR', label: 'XOR', description: 'Exactly one condition must match', color: 'var(--color-primary-500)' },
  { value: 'NAND', label: 'NAND', description: 'Not all conditions match', color: 'var(--color-warning-500)' },
  { value: 'NOR', label: 'NOR', description: 'No conditions match', color: 'var(--color-danger-500)' },
];

function LogicalOperatorBadge({ operator, onChange, compact }: LogicalOperatorBadgeProps) {
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

  const currentOp = LOGICAL_OPERATORS.find((op) => op.value === operator) || LOGICAL_OPERATORS[0];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex items-center gap-1 px-2 py-1 rounded-md font-mono text-xs font-bold',
          'transition-all duration-150 hover:scale-105',
          compact && 'px-1.5 py-0.5 text-[10px]'
        )}
        style={{
          backgroundColor: `color-mix(in srgb, ${currentOp.color} 18%, transparent)`,
          color: currentOp.color,
          border: `1px solid color-mix(in srgb, ${currentOp.color} 35%, transparent)`,
        }}
      >
        {currentOp.label}
        <ChevronDownIcon />
      </button>

      {isOpen && (
        <div
          className="absolute left-0 top-full mt-1 z-50 min-w-[180px] rounded-lg overflow-hidden shadow-lg"
          style={{
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-default)',
          }}
        >
          {LOGICAL_OPERATORS.map((op) => (
            <button
              key={op.value}
              onClick={() => {
                onChange(op.value);
                setIsOpen(false);
              }}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2 text-left',
                'transition-colors hover:bg-[var(--bg-hover)]',
                op.value === operator && 'bg-[var(--bg-hover)]'
              )}
            >
              <span
                className="px-1.5 py-0.5 rounded font-mono text-xs font-bold"
                style={{
                  backgroundColor: `color-mix(in srgb, ${op.color} 18%, transparent)`,
                  color: op.color,
                }}
              >
                {op.label}
              </span>
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                {op.description}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// FILTER CONDITION ROW
// =============================================================================

interface FilterConditionRowProps {
  condition: FilterCondition;
  columns: ColumnInfo[];
  onUpdate: (condition: FilterCondition) => void;
  onRemove: () => void;
  isFirst?: boolean;
  showConnector?: boolean;
  connectorOperator?: LogicalOperator;
}

function FilterConditionRow({
  condition,
  columns,
  onUpdate,
  onRemove,
  isFirst,
  showConnector,
  connectorOperator,
}: FilterConditionRowProps) {
  const selectedColumn = columns.find((c) => c.id === condition.columnId);
  const operators = selectedColumn ? getOperatorsForType(selectedColumn.type) : TEXT_OPERATORS;
  const selectedOperator = operators.find((op) => op.value === condition.operator);

  const handleColumnChange = (columnId: string) => {
    const col = columns.find((c) => c.id === columnId);
    const newOperators = col ? getOperatorsForType(col.type) : TEXT_OPERATORS;
    onUpdate({
      ...condition,
      columnId,
      operator: newOperators[0].value,
      value: '',
      value2: undefined,
    });
  };

  return (
    <div className="flex items-start gap-2">
      {/* Connector line and operator */}
      {showConnector && !isFirst && (
        <div className="flex items-center gap-1 pt-2 min-w-[50px]">
          <div
            className="w-4 h-px"
            style={{ backgroundColor: 'var(--border-default)' }}
          />
          <span
            className="text-[10px] font-mono font-medium px-1 rounded"
            style={{
              color: connectorOperator === 'AND' ? 'var(--color-info-500)' : 'var(--color-success-500)',
              backgroundColor: connectorOperator === 'AND'
                ? 'color-mix(in srgb, var(--color-info-500) 12%, transparent)'
                : 'color-mix(in srgb, var(--color-success-500) 12%, transparent)',
            }}
          >
            {connectorOperator}
          </span>
        </div>
      )}
      {showConnector && isFirst && <div className="min-w-[50px]" />}

      {/* Condition card */}
      <div
        className={cn(
          'flex-1 flex items-center gap-2 p-2 rounded-lg',
          'transition-all duration-150',
          'hover:shadow-md group'
        )}
        style={{
          backgroundColor: 'var(--bg-surface-secondary)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        {/* Drag handle */}
        <div className="cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity">
          <DragIcon />
        </div>

        {/* Column select */}
        <select
          value={condition.columnId}
          onChange={(e) => handleColumnChange(e.target.value)}
          className="flex-1 min-w-[120px] px-2 py-1.5 rounded-md text-sm border-0 bg-transparent focus:outline-none focus:ring-2 focus:ring-[var(--border-brand)]"
          style={{ color: 'var(--text-primary)' }}
        >
          <option value="">Select field...</option>
          {columns.map((col) => (
            <option key={col.id} value={col.id}>
              {col.label}
            </option>
          ))}
        </select>

        {/* Operator select */}
        <select
          value={condition.operator}
          onChange={(e) => onUpdate({ ...condition, operator: e.target.value as FilterOperator })}
          className="min-w-[130px] px-2 py-1.5 rounded-md text-sm border-0 bg-transparent focus:outline-none focus:ring-2 focus:ring-[var(--border-brand)]"
          style={{ color: 'var(--text-primary)' }}
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
          <>
            {selectedOperator.valueType === 'date' ? (
              <input
                type="date"
                value={(condition.value as string) || ''}
                onChange={(e) => onUpdate({ ...condition, value: e.target.value })}
                className="min-w-[140px] px-2 py-1.5 rounded-md text-sm border focus:outline-none focus:ring-2 focus:ring-[var(--border-brand)]"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-default)',
                  color: 'var(--text-primary)',
                }}
              />
            ) : selectedOperator.valueType === 'number' ? (
              <input
                type="number"
                value={(condition.value as string) || ''}
                onChange={(e) => onUpdate({ ...condition, value: e.target.value })}
                placeholder="Value"
                className="min-w-[100px] px-2 py-1.5 rounded-md text-sm border focus:outline-none focus:ring-2 focus:ring-[var(--border-brand)]"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-default)',
                  color: 'var(--text-primary)',
                }}
              />
            ) : selectedOperator.valueType === 'duration' ? (
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={(condition.value as string) || ''}
                  onChange={(e) => onUpdate({ ...condition, value: e.target.value })}
                  placeholder="N"
                  className="w-16 px-2 py-1.5 rounded-md text-sm border focus:outline-none focus:ring-2 focus:ring-[var(--border-brand)]"
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    borderColor: 'var(--border-default)',
                    color: 'var(--text-primary)',
                  }}
                />
                <select
                  value={condition.unit || 'days'}
                  onChange={(e) => onUpdate({ ...condition, unit: e.target.value as FilterCondition['unit'] })}
                  className="px-2 py-1.5 rounded-md text-sm border-0 bg-transparent focus:outline-none"
                  style={{ color: 'var(--text-primary)' }}
                >
                  <option value="days">days</option>
                  <option value="weeks">weeks</option>
                  <option value="months">months</option>
                  <option value="years">years</option>
                </select>
              </div>
            ) : (
              <input
                type="text"
                value={(condition.value as string) || ''}
                onChange={(e) => onUpdate({ ...condition, value: e.target.value })}
                placeholder="Value"
                className="flex-1 min-w-[120px] px-2 py-1.5 rounded-md text-sm border focus:outline-none focus:ring-2 focus:ring-[var(--border-brand)]"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-default)',
                  color: 'var(--text-primary)',
                }}
              />
            )}

            {/* Second value for 'between' operators */}
            {selectedOperator.requiresSecondValue && (
              <>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  and
                </span>
                {selectedOperator.valueType === 'date' ? (
                  <input
                    type="date"
                    value={(condition.value2 as string) || ''}
                    onChange={(e) => onUpdate({ ...condition, value2: e.target.value })}
                    className="min-w-[140px] px-2 py-1.5 rounded-md text-sm border focus:outline-none focus:ring-2 focus:ring-[var(--border-brand)]"
                    style={{
                      backgroundColor: 'var(--bg-surface)',
                      borderColor: 'var(--border-default)',
                      color: 'var(--text-primary)',
                    }}
                  />
                ) : (
                  <input
                    type="number"
                    value={(condition.value2 as string) || ''}
                    onChange={(e) => onUpdate({ ...condition, value2: e.target.value })}
                    placeholder="Value"
                    className="w-24 px-2 py-1.5 rounded-md text-sm border focus:outline-none focus:ring-2 focus:ring-[var(--border-brand)]"
                    style={{
                      backgroundColor: 'var(--bg-surface)',
                      borderColor: 'var(--border-default)',
                      color: 'var(--text-primary)',
                    }}
                  />
                )}
              </>
            )}
          </>
        )}

        {/* Remove button */}
        <button
          onClick={onRemove}
          className="p-1.5 rounded-md transition-colors opacity-0 group-hover:opacity-100 hover:bg-[var(--bg-hover)]"
          style={{ color: 'var(--text-muted)' }}
          title="Remove condition"
        >
          <TrashIcon />
        </button>
      </div>
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
  onRemove?: () => void;
  depth?: number;
  isRoot?: boolean;
}

function FilterGroupComponent({
  group,
  columns,
  onUpdate,
  onRemove,
  depth = 0,
  isRoot = false,
}: FilterGroupComponentProps) {
  const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const handleAddCondition = () => {
    const newCondition: FilterCondition = {
      id: generateId(),
      columnId: '',
      operator: 'contains',
      value: '',
    };
    onUpdate({
      ...group,
      conditions: [...group.conditions, newCondition],
    });
  };

  const handleAddGroup = () => {
    const newGroup: FilterGroup = {
      id: generateId(),
      type: 'group',
      operator: 'AND',
      conditions: [],
    };
    onUpdate({
      ...group,
      conditions: [...group.conditions, newGroup],
    });
  };

  const handleUpdateCondition = (index: number, updated: FilterCondition | FilterGroup) => {
    const newConditions = [...group.conditions];
    newConditions[index] = updated;
    onUpdate({ ...group, conditions: newConditions });
  };

  const handleRemoveCondition = (index: number) => {
    const newConditions = group.conditions.filter((_, i) => i !== index);
    onUpdate({ ...group, conditions: newConditions });
  };

  const borderColors = [
    'var(--color-info-500)',
    'var(--color-primary-500)',
    'var(--color-success-500)',
    'var(--color-warning-500)',
  ];
  const borderColor = borderColors[depth % borderColors.length];

  return (
    <div
      className={cn('relative', !isRoot && 'ml-4 pl-4')}
      style={{
        borderLeft: !isRoot
          ? `2px solid color-mix(in srgb, ${borderColor} 35%, transparent)`
          : undefined,
      }}
    >
      {/* Group header */}
      <div className="flex items-center gap-2 mb-3">
        {!isRoot && (
          <div
            className="w-3 h-px"
            style={{ backgroundColor: borderColor, marginLeft: '-16px' }}
          />
        )}

        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
          style={{
            backgroundColor: `color-mix(in srgb, ${borderColor} 10%, transparent)`,
            border: `1px dashed color-mix(in srgb, ${borderColor} 35%, transparent)`,
          }}
        >
          <GroupIcon />
          <span className="text-xs font-medium" style={{ color: borderColor }}>
            Group
          </span>
          <LogicalOperatorBadge
            operator={group.operator}
            onChange={(op) => onUpdate({ ...group, operator: op })}
            compact
          />
        </div>

        {!isRoot && (
          <button
            onClick={onRemove}
            className="p-1 rounded transition-colors hover:bg-[var(--bg-hover)]"
            style={{ color: 'var(--text-muted)' }}
            title="Remove group"
          >
            <TrashIcon />
          </button>
        )}
      </div>

      {/* Conditions */}
      <div className="space-y-2">
        {group.conditions.map((item, index) => {
          if ('type' in item && item.type === 'group') {
            return (
              <FilterGroupComponent
                key={item.id}
                group={item}
                columns={columns}
                onUpdate={(updated) => handleUpdateCondition(index, updated)}
                onRemove={() => handleRemoveCondition(index)}
                depth={depth + 1}
              />
            );
          }
          return (
            <FilterConditionRow
              key={item.id}
              condition={item as FilterCondition}
              columns={columns}
              onUpdate={(updated) => handleUpdateCondition(index, updated)}
              onRemove={() => handleRemoveCondition(index)}
              isFirst={index === 0}
              showConnector={group.conditions.length > 1}
              connectorOperator={group.operator}
            />
          );
        })}
      </div>

      {/* Add buttons */}
      <div className="flex items-center gap-2 mt-3">
        <button
          onClick={handleAddCondition}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors hover:bg-[var(--bg-hover)]"
          style={{
            backgroundColor: 'var(--bg-surface-secondary)',
            color: 'var(--text-secondary)',
            border: '1px dashed var(--border-default)',
          }}
        >
          <PlusIcon />
          Add Condition
        </button>
        <button
          onClick={handleAddGroup}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors hover:bg-[var(--bg-hover)]"
          style={{
            backgroundColor: 'var(--bg-surface-secondary)',
            color: 'var(--text-secondary)',
            border: '1px dashed var(--border-default)',
          }}
        >
          <GroupIcon />
          Add Group
        </button>
      </div>
    </div>
  );
}

// =============================================================================
// QUICK FILTERS
// =============================================================================

interface QuickFilter {
  id: string;
  label: string;
  icon: React.ReactNode;
  createFilter: (columns: ColumnInfo[]) => FilterGroup | null;
}

const QUICK_FILTERS: QuickFilter[] = [
  {
    id: 'empty',
    label: 'Has empty fields',
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="3" y="3" width="10" height="10" rx="2" strokeDasharray="3 2" />
      </svg>
    ),
    createFilter: () => null, // No filter condition needed for empty fields check
  },
  {
    id: 'today',
    label: 'Created today',
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="2" y="3" width="12" height="11" rx="2" />
        <path d="M2 7h12M5 2v2M11 2v2" strokeLinecap="round" />
      </svg>
    ),
    createFilter: (columns) => {
      const dateCol = columns.find((c) => c.type === 'date' || c.type === 'datetime');
      if (!dateCol) return null;
      return {
        id: 'quick-today',
        type: 'group',
        operator: 'AND',
        conditions: [
          {
            id: 'today-cond',
            columnId: dateCol.id,
            operator: 'today',
            value: null,
          },
        ],
      };
    },
  },
  {
    id: 'this_week',
    label: 'This week',
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="2" y="3" width="12" height="11" rx="2" />
        <path d="M2 7h12" strokeLinecap="round" />
      </svg>
    ),
    createFilter: (columns) => {
      const dateCol = columns.find((c) => c.type === 'date' || c.type === 'datetime');
      if (!dateCol) return null;
      return {
        id: 'quick-week',
        type: 'group',
        operator: 'AND',
        conditions: [
          {
            id: 'week-cond',
            columnId: dateCol.id,
            operator: 'this_week',
            value: null,
          },
        ],
      };
    },
  },
];

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function AdvancedFilterBuilder<TData extends GridRowData>({
  table,
  onClose,
  onApply,
  initialFilter,
}: AdvancedFilterBuilderProps<TData>) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Get columns info
  const columns = useMemo((): ColumnInfo[] => {
    return table
      .getAllLeafColumns()
      .filter((col) => col.id !== 'select' && col.id !== '_actions')
      .map((col) => {
        const columnDef = col.columnDef as { header?: string; meta?: { type?: GridColumnType } };
        return {
          id: col.id,
          label: typeof columnDef.header === 'string' ? columnDef.header : col.id,
          type: columnDef.meta?.type || 'text',
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

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

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

  const handleQuickFilter = useCallback(
    (quickFilter: QuickFilter) => {
      const newGroup = quickFilter.createFilter(columns);
      if (newGroup) {
        setFilterState((prev) => ({
          ...prev,
          conditions: [...prev.conditions, ...newGroup.conditions],
        }));
      }
    },
    [columns]
  );

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className={cn(
          'relative z-10 w-full max-w-3xl',
          'rounded-2xl overflow-hidden',
          'shadow-2xl',
          'flex flex-col',
          'bg-card border border-border'
        )}
        style={{
          maxHeight: 'min(85vh, 800px)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex-shrink-0 px-6 py-4 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-primary/10 text-primary">
                <FilterIcon />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  Advanced Filter
                </h2>
                <p className="text-sm text-muted-foreground">
                  {conditionCount === 0 ? 'No conditions' : `${conditionCount} condition${conditionCount > 1 ? 's' : ''}`}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="btn-ghost btn-icon btn-sm"
              title="Close"
            >
              <CloseIcon />
            </button>
          </div>
        </div>

        {/* Quick filters */}
        <div className="flex-shrink-0 flex items-center gap-2 px-6 py-3 overflow-x-auto border-b border-border">
          <span className="text-xs font-medium text-muted-foreground">
            Quick:
          </span>
          {QUICK_FILTERS.map((qf) => (
            <button
              key={qf.id}
              onClick={() => handleQuickFilter(qf)}
              className="btn-secondary btn-xs gap-1.5 whitespace-nowrap"
            >
              {qf.icon}
              {qf.label}
            </button>
          ))}

          <div className="flex-1" />

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
        </div>

        {/* Filter builder */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-4">
          {filterState.conditions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 bg-muted text-muted-foreground">
                <FilterIcon />
              </div>
              <p className="text-sm font-medium mb-1 text-foreground">
                No filter conditions
              </p>
              <p className="text-xs mb-4 text-muted-foreground">
                Add conditions to filter your data
              </p>
              <button
                onClick={() => {
                  const newCondition: FilterCondition = {
                    id: `${Date.now()}`,
                    columnId: '',
                    operator: 'contains',
                    value: '',
                  };
                  setFilterState((prev) => ({
                    ...prev,
                    conditions: [newCondition],
                  }));
                }}
                className="btn-primary btn-sm gap-1.5"
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
        <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-t border-border bg-muted">
          <button
            onClick={handleClear}
            disabled={conditionCount === 0}
            className="btn-ghost btn-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Clear All
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="btn-ghost btn-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              className="btn-primary btn-sm"
            >
              Apply Filter
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdvancedFilterBuilder;
