/**
 * FilterPanel Component
 *
 * A theme-aware, accessible query builder for creating complex filter conditions.
 * Supports nested groups, multiple operators, and type-aware field filtering.
 *
 * Theme Integration:
 * - Uses Tailwind CSS utility classes with design tokens
 * - Supports light/dark mode through Tailwind dark mode variants
 * - All colors are derived from semantic design tokens
 *
 * Accessibility:
 * - WCAG 2.1 AA compliant with proper ARIA attributes
 * - Keyboard navigation support
 * - Touch targets meet minimum 44px requirement
 * - Screen reader friendly with descriptive labels
 * - Focus indicators for all interactive elements
 */

import React, { useState, useCallback } from 'react';
import {
  Plus,
  X,
  ChevronDown,
  Calendar,
  Hash,
  Type,
  ToggleLeft,
  Clock,
  Check,
  Parentheses,
} from 'lucide-react';
import {
  FilterRule,
  FilterGroup,
  FilterNode,
  isFilterGroup,
  generateFilterId,
} from './types';

interface FilterPanelProps {
  fields: { code: string; label: string; type?: string }[];
  rules: FilterRule[];
  onChange: (next: FilterRule[]) => void;
  onClose: () => void;
}

// Field type icons
const getFieldIcon = (type?: string) => {
  switch (type?.toLowerCase()) {
    case 'number':
    case 'integer':
    case 'decimal':
      return Hash;
    case 'boolean':
      return ToggleLeft;
    case 'date':
      return Calendar;
    case 'datetime':
    case 'timestamp':
      return Clock;
    default:
      return Type;
  }
};

// Operators based on field type
const getOperatorsForType = (type?: string) => {
  const baseOperators = [
    { value: 'equals', label: '=' },
    { value: 'not_equals', label: '!=' },
    { value: 'is_empty', label: 'is empty' },
    { value: 'is_not_empty', label: 'not empty' },
  ];

  const textOperators = [
    { value: 'contains', label: 'contains' },
    { value: 'not_contains', label: '!contains' },
    { value: 'starts_with', label: 'starts' },
    { value: 'ends_with', label: 'ends' },
  ];

  const numberOperators = [
    { value: 'greater_than', label: '>' },
    { value: 'less_than', label: '<' },
    { value: 'greater_or_equal', label: '>=' },
    { value: 'less_or_equal', label: '<=' },
    { value: 'between', label: 'between' },
  ];

  const dateOperators = [
    { value: 'before', label: 'before' },
    { value: 'after', label: 'after' },
    { value: 'between', label: 'between' },
    { value: 'today', label: 'today' },
    { value: 'this_week', label: 'this week' },
  ];

  const booleanOperators = [
    { value: 'is_true', label: 'true' },
    { value: 'is_false', label: 'false' },
  ];

  switch (type?.toLowerCase()) {
    case 'number':
    case 'integer':
    case 'decimal':
      return [...baseOperators, ...numberOperators];
    case 'date':
    case 'datetime':
    case 'timestamp':
      return [...baseOperators, ...dateOperators];
    case 'boolean':
      return booleanOperators;
    default:
      return [...baseOperators, ...textOperators];
  }
};

const operatorNeedsValue = (operator: string) => {
  return ![
    'is_empty', 'is_not_empty', 'is_true', 'is_false',
    'today', 'this_week', 'this_month', 'last_7_days', 'last_30_days',
  ].includes(operator);
};

const getOperatorLabel = (operator: string) => {
  const labels: Record<string, string> = {
    equals: '=',
    not_equals: '!=',
    contains: 'contains',
    not_contains: '!contains',
    starts_with: 'starts',
    ends_with: 'ends',
    greater_than: '>',
    less_than: '<',
    greater_or_equal: '>=',
    less_or_equal: '<=',
    between: 'between',
    is_empty: 'empty',
    is_not_empty: '!empty',
    is_true: 'true',
    is_false: 'false',
    before: 'before',
    after: 'after',
    today: 'today',
    this_week: 'this week',
  };
  return labels[operator] || operator;
};

// Convert flat rules to nested structure for display
const rulesToFilterGroup = (rules: FilterRule[]): FilterGroup => {
  return {
    id: 'root',
    type: 'group',
    logic: 'AND',
    children: rules.map(r => ({ ...r, id: r.id || generateFilterId() })),
  };
};

// Flatten nested structure back to rules (simplified - just top-level AND)
const filterGroupToRules = (group: FilterGroup): FilterRule[] => {
  const flatten = (node: FilterNode): FilterRule[] => {
    if (isFilterGroup(node)) {
      return node.children.flatMap(flatten);
    }
    return [node];
  };
  return flatten(group);
};

// Filter Pill Component - displays a single filter condition
interface FilterPillProps {
  rule: FilterRule;
  fieldLabel: string;
  onRemove: () => void;
  onEdit: () => void;
}

const FilterPill: React.FC<FilterPillProps> = ({ rule, fieldLabel, onRemove, onEdit }) => {
  const needsValue = operatorNeedsValue(rule.operator);
  const displayValue = needsValue ? (rule.value || '?') : '';

  return (
    <div
      onClick={onEdit}
      role="button"
      tabIndex={0}
      aria-label={`Edit filter: ${fieldLabel} ${getOperatorLabel(rule.operator)} ${displayValue}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onEdit();
        }
      }}
      className="inline-flex items-center gap-1 px-2 py-2 rounded-lg text-xs cursor-pointer transition-colors group min-h-[44px] bg-primary/10 border border-primary hover:bg-primary/20"
    >
      <span className="font-medium text-primary">
        {fieldLabel}
      </span>
      <span className="text-primary">
        {getOperatorLabel(rule.operator)}
      </span>
      {displayValue && (
        <span className="font-medium max-w-[100px] truncate text-primary">
          "{displayValue}"
        </span>
      )}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        aria-label={`Remove filter: ${fieldLabel}`}
        className="ml-0.5 p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity text-primary hover:text-destructive min-w-[44px] min-h-[44px] flex items-center justify-center"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
};

// Logic Operator Badge
interface LogicBadgeProps {
  logic: 'AND' | 'OR';
  onChange: (logic: 'AND' | 'OR') => void;
}

const LogicBadge: React.FC<LogicBadgeProps> = ({ logic, onChange }) => (
  <button
    type="button"
    onClick={() => onChange(logic === 'AND' ? 'OR' : 'AND')}
    aria-label={`Change logic operator from ${logic} to ${logic === 'AND' ? 'OR' : 'AND'}`}
    className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full cursor-pointer transition-colors min-w-[44px] min-h-[44px] inline-flex items-center justify-center ${
      logic === 'AND'
        ? 'bg-muted text-muted-foreground hover:bg-muted/80'
        : 'bg-warning-subtle text-warning-text hover:bg-warning-subtle'
    }`}
  >
    {logic}
  </button>
);

// Inline Filter Editor
interface FilterEditorProps {
  fields: { code: string; label: string; type?: string }[];
  rule: FilterRule | null;
  onSave: (rule: FilterRule) => void;
  onCancel: () => void;
}

const FilterEditor: React.FC<FilterEditorProps> = ({ fields, rule, onSave, onCancel }) => {
  const [field, setField] = useState(rule?.field || '');
  const [operator, setOperator] = useState(rule?.operator || 'equals');
  const [value, setValue] = useState(rule?.value || '');
  const [value2, setValue2] = useState(rule?.value2 || '');
  const [showFieldList, setShowFieldList] = useState(!rule?.field);
  const [fieldSearch, setFieldSearch] = useState('');

  const selectedField = fields.find(f => f.code === field);
  const operators = getOperatorsForType(selectedField?.type);
  const needsValue = operatorNeedsValue(operator);
  const needsTwoValues = operator === 'between';
  const fieldType = selectedField?.type;
  const inputType = fieldType === 'number' || fieldType === 'integer' ? 'number' : fieldType === 'date' ? 'date' : 'text';

  const filteredFields = fields.filter(
    f => f.label.toLowerCase().includes(fieldSearch.toLowerCase()) ||
         f.code.toLowerCase().includes(fieldSearch.toLowerCase())
  );

  const handleSave = () => {
    if (!field) return;
    onSave({
      id: rule?.id || generateFilterId(),
      field,
      operator,
      value: needsValue ? value : '',
      value2: needsTwoValues ? value2 : undefined,
    });
  };

  const FieldIcon = getFieldIcon(selectedField?.type);

  return (
    <div
      role="dialog"
      aria-label={rule ? 'Edit filter condition' : 'Add filter condition'}
      className="rounded-lg shadow-lg p-3 space-y-3 bg-card border border-border"
    >
      {/* Field Selection */}
      {showFieldList ? (
        <div className="space-y-2">
          <input
            type="text"
            value={fieldSearch}
            onChange={(e) => setFieldSearch(e.target.value)}
            placeholder="Search fields..."
            aria-label="Search fields"
            className="w-full px-3 h-[44px] text-sm rounded-lg border border-border bg-card text-foreground focus:ring-2 focus:ring-primary focus:border-primary focus:outline-none"
            autoFocus
          />
          <div className="max-h-40 overflow-y-auto space-y-0.5" role="listbox" aria-label="Field list">
            {filteredFields.map(f => {
              const Icon = getFieldIcon(f.type);
              const isSelected = field === f.code;
              return (
                <button
                  key={f.code}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    setField(f.code);
                    setOperator(getOperatorsForType(f.type)[0].value);
                    setShowFieldList(false);
                  }}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-md transition-colors min-h-[44px] ${
                    isSelected
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-muted'
                  }`}
                >
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <span className="flex-1 text-left truncate">{f.label}</span>
                  {isSelected && <Check className="h-4 w-4 text-primary" />}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <>
          {/* Selected Field Display */}
          <button
            type="button"
            onClick={() => setShowFieldList(true)}
            aria-label={`Change field from ${selectedField?.label}`}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors bg-muted border border-border min-h-[44px] hover:bg-muted/80"
          >
            <FieldIcon className="h-4 w-4 text-primary" />
            <span className="font-medium text-foreground">
              {selectedField?.label}
            </span>
            <ChevronDown className="h-4 w-4 ml-auto text-muted-foreground" />
          </button>

          {/* Operator + Value Row */}
          <div className="flex items-center gap-2">
            <select
              value={operator}
              onChange={(e) => setOperator(e.target.value)}
              aria-label="Filter operator"
              className="px-2 h-[44px] text-sm rounded-lg border border-border bg-card text-foreground focus:ring-2 focus:ring-primary focus:border-primary focus:outline-none"
            >
              {operators.map(op => (
                <option key={op.value} value={op.value}>{op.label}</option>
              ))}
            </select>

            {needsValue && (
              <input
                type={inputType}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="Value..."
                aria-label="Filter value"
                className="flex-1 px-3 h-[44px] text-sm rounded-lg border border-border bg-card text-foreground focus:ring-2 focus:ring-primary focus:border-primary focus:outline-none"
                autoFocus
              />
            )}
          </div>

          {needsTwoValues && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">and</span>
              <input
                type={inputType}
                value={value2}
                onChange={(e) => setValue2(e.target.value)}
                placeholder="Value..."
                aria-label="Second filter value"
                className="flex-1 px-3 h-[44px] text-sm rounded-lg border border-border bg-card text-foreground focus:ring-2 focus:ring-primary focus:border-primary focus:outline-none"
              />
            </div>
          )}
        </>
      )}

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
        <button
          type="button"
          onClick={onCancel}
          aria-label="Cancel editing"
          className="px-3 min-h-[44px] text-xs font-medium rounded-lg transition-colors text-muted-foreground bg-muted hover:bg-muted/80 hover:text-foreground"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={!field || (needsValue && !value)}
          aria-label={rule ? 'Update filter' : 'Add filter'}
          className={`px-3 min-h-[44px] text-xs font-medium rounded-lg transition-colors ${
            (!field || (needsValue && !value))
              ? 'bg-muted text-muted-foreground cursor-not-allowed'
              : 'bg-primary text-primary-foreground hover:bg-primary/90'
          }`}
        >
          {rule ? 'Update' : 'Add'}
        </button>
      </div>
    </div>
  );
};

export const FilterPanel: React.FC<FilterPanelProps> = ({
  fields,
  rules,
  onChange,
  onClose,
}) => {
  // Initialize filter group with IDs
  const [filterGroup, setFilterGroup] = useState<FilterGroup>(() =>
    rulesToFilterGroup(rules.map(r => ({ ...r, id: (r as any).id || generateFilterId() })))
  );
  const [editingRule, setEditingRule] = useState<FilterRule | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [showEditor, setShowEditor] = useState(false);

  const getPropertyLabel = useCallback(
    (propertyCode: string) => fields.find(f => f.code === propertyCode)?.label || propertyCode,
    [fields]
  );

  const addCondition = () => {
    setEditingRule(null);
    setEditingIndex(null);
    setShowEditor(true);
  };

  const addGroup = () => {
    const newGroup: FilterGroup = {
      id: generateFilterId(),
      type: 'group',
      logic: 'OR',
      children: [],
    };
    setFilterGroup(prev => ({
      ...prev,
      children: [...prev.children, newGroup],
    }));
  };

  const saveRule = (rule: FilterRule) => {
    setFilterGroup(prev => {
      if (editingIndex !== null) {
        // Update existing rule
        const newChildren = [...prev.children];
        newChildren[editingIndex] = rule;
        return { ...prev, children: newChildren };
      } else {
        // Add new rule
        return { ...prev, children: [...prev.children, rule] };
      }
    });
    setShowEditor(false);
    setEditingRule(null);
    setEditingIndex(null);
  };

  const removeRule = (index: number) => {
    setFilterGroup(prev => ({
      ...prev,
      children: prev.children.filter((_, i) => i !== index),
    }));
  };

  const editRule = (index: number) => {
    const node = filterGroup.children[index];
    if (!isFilterGroup(node)) {
      setEditingRule(node);
      setEditingIndex(index);
      setShowEditor(true);
    }
  };

  const toggleLogic = () => {
    setFilterGroup(prev => ({
      ...prev,
      logic: prev.logic === 'AND' ? 'OR' : 'AND',
    }));
  };

  const clearAll = () => {
    setFilterGroup({ id: 'root', type: 'group', logic: 'AND', children: [] });
  };

  const apply = () => {
    const flatRules = filterGroupToRules(filterGroup);
    onChange(flatRules);
    onClose();
  };

  // Build query string for display
  const buildQueryString = (): string => {
    const buildNode = (node: FilterNode): string => {
      if (isFilterGroup(node)) {
        if (node.children.length === 0) return '';
        const parts = node.children.map(buildNode).filter(Boolean);
        if (parts.length === 0) return '';
        if (parts.length === 1) return parts[0];
        return `(${parts.join(` ${node.logic} `)})`;
      } else {
        const fieldLabel = getPropertyLabel(node.field);
        const op = getOperatorLabel(node.operator);
        const val = operatorNeedsValue(node.operator) ? `"${node.value}"` : '';
        return `${fieldLabel} ${op} ${val}`.trim();
      }
    };
    return buildNode(filterGroup);
  };

  const queryString = buildQueryString();
  const hasFilters = filterGroup.children.length > 0;

  return (
    <div
      className="h-full flex flex-col bg-muted"
      role="region"
      aria-label="Filter query builder"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-card border-b border-border">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-foreground">
            Query Builder
          </h3>
          {hasFilters && (
            <span
              className="text-xs px-2 py-0.5 rounded-full text-muted-foreground bg-muted"
              aria-label={`${filterGroup.children.length} active filters`}
            >
              {filterGroup.children.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {hasFilters && (
            <button
              type="button"
              onClick={clearAll}
              aria-label="Clear all filters"
              className="text-xs px-2 py-1 rounded transition-colors min-h-[44px] text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            >
              Clear
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close query builder"
            className="p-1 min-w-[44px] min-h-[44px] flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Query Preview (like ServiceNow breadcrumb query) */}
      {hasFilters && (
        <div className="px-4 py-2 bg-muted/50 border-b border-border">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase text-muted-foreground">
              Query:
            </span>
            <code
              className="flex-1 text-xs font-mono truncate text-muted-foreground"
              aria-label={`Query: ${queryString}`}
            >
              {queryString}
            </code>
          </div>
        </div>
      )}

      {/* Content - Filter Pills */}
      <div className="flex-1 overflow-y-auto p-4">
        {!hasFilters && !showEditor ? (
          <div className="text-center py-8">
            <p className="text-sm mb-4 text-muted-foreground">
              No conditions defined
            </p>
            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={addCondition}
                aria-label="Add filter condition"
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg shadow-sm min-h-[44px] bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Plus className="h-4 w-4" />
                Add Condition
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Logic Toggle for root group */}
            {filterGroup.children.length > 1 && (
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs text-muted-foreground">
                  Match
                </span>
                <LogicBadge logic={filterGroup.logic} onChange={toggleLogic} />
                <span className="text-xs text-muted-foreground">
                  of the following:
                </span>
              </div>
            )}

            {/* Filter Pills Row */}
            <div className="flex flex-wrap items-center gap-2" role="list" aria-label="Active filters">
              {filterGroup.children.map((node, index) => {
                if (isFilterGroup(node)) {
                  // Nested group - show as grouped pills
                  return (
                    <div
                      key={node.id}
                      role="listitem"
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg min-h-[44px] bg-warning-subtle border border-warning-border"
                    >
                      <Parentheses className="h-3 w-3 text-warning-text" />
                      <span className="text-xs text-warning-text">
                        {node.children.length} conditions ({node.logic})
                      </span>
                      <button
                        type="button"
                        onClick={() => removeRule(index)}
                        aria-label={`Remove grouped conditions`}
                        className="ml-1 p-0.5 rounded transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center text-warning-text hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  );
                }

                return (
                  <React.Fragment key={node.id}>
                    {index > 0 && (
                      <LogicBadge
                        logic={filterGroup.logic}
                        onChange={toggleLogic}
                      />
                    )}
                    <FilterPill
                      rule={node}
                      fieldLabel={getPropertyLabel(node.field)}
                      onRemove={() => removeRule(index)}
                      onEdit={() => editRule(index)}
                    />
                  </React.Fragment>
                );
              })}

              {/* Add buttons */}
              {!showEditor && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={addCondition}
                    aria-label="Add new condition"
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium border border-dashed rounded-lg transition-colors min-h-[44px] text-primary border-primary hover:bg-primary/10"
                  >
                    <Plus className="h-3 w-3" />
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={addGroup}
                    aria-label="Add grouped conditions"
                    title="Add grouped conditions (OR)"
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium border border-dashed rounded-lg transition-colors min-h-[44px] text-warning-text border-warning-border hover:bg-warning-subtle"
                  >
                    <Parentheses className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>

            {/* Inline Editor */}
            {showEditor && (
              <div className="mt-3">
                <FilterEditor
                  fields={fields}
                  rule={editingRule}
                  onSave={saveRule}
                  onCancel={() => {
                    setShowEditor(false);
                    setEditingRule(null);
                    setEditingIndex(null);
                  }}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between gap-2 px-4 py-3 bg-card border-t border-border">
        <span className="text-xs text-muted-foreground">
          {hasFilters ? `${filterGroup.children.length} condition${filterGroup.children.length !== 1 ? 's' : ''}` : 'No filters'}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            aria-label="Cancel and close"
            className="px-4 py-2 text-sm font-medium rounded-lg transition-colors min-h-[44px] text-muted-foreground bg-muted hover:bg-muted/80 hover:text-foreground"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={apply}
            aria-label="Apply filters"
            className="px-4 py-2 text-sm font-medium rounded-lg shadow-sm flex items-center gap-1.5 transition-colors min-h-[44px] bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Check className="h-4 w-4" />
            Apply
          </button>
        </div>
      </div>
    </div>
  );
};
