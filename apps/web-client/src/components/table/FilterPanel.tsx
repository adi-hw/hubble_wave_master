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
      className="inline-flex items-center gap-1 px-2 py-1 bg-primary-50 border border-primary-200 rounded-lg text-xs cursor-pointer hover:bg-primary-100 transition-colors group"
    >
      <span className="font-medium text-primary-700">{fieldLabel}</span>
      <span className="text-primary-500">{getOperatorLabel(rule.operator)}</span>
      {displayValue && (
        <span className="text-primary-800 font-medium max-w-[100px] truncate">"{displayValue}"</span>
      )}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="ml-0.5 p-0.5 text-primary-400 hover:text-danger-600 rounded opacity-0 group-hover:opacity-100 transition-opacity"
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
    className={`
      px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full cursor-pointer transition-colors
      ${logic === 'AND'
        ? 'bg-slate-200 text-slate-600 hover:bg-slate-300'
        : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
      }
    `}
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
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3 space-y-3">
      {/* Field Selection */}
      {showFieldList ? (
        <div className="space-y-2">
          <input
            type="text"
            value={fieldSearch}
            onChange={(e) => setFieldSearch(e.target.value)}
            placeholder="Search fields..."
            className="w-full h-8 px-3 text-sm border border-slate-200 rounded-lg focus:border-primary-300 focus:ring-2 focus:ring-primary-100 focus:outline-none"
            autoFocus
          />
          <div className="max-h-40 overflow-y-auto space-y-0.5">
            {filteredFields.map(f => {
              const Icon = getFieldIcon(f.type);
              return (
                <button
                  key={f.code}
                  type="button"
                  onClick={() => {
                    setField(f.code);
                    setOperator(getOperatorsForType(f.type)[0].value);
                    setShowFieldList(false);
                  }}
                  className={`
                    w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-md transition-colors
                    ${field === f.code ? 'bg-primary-50 text-primary-700' : 'text-slate-700 hover:bg-slate-50'}
                  `}
                >
                  <Icon className="h-4 w-4 text-slate-400" />
                  <span className="flex-1 text-left truncate">{f.label}</span>
                  {field === f.code && <Check className="h-4 w-4 text-primary-600" />}
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
            className="w-full flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm hover:bg-slate-100 transition-colors"
          >
            <FieldIcon className="h-4 w-4 text-primary-500" />
            <span className="font-medium text-slate-900">{selectedField?.label}</span>
            <ChevronDown className="h-4 w-4 text-slate-400 ml-auto" />
          </button>

          {/* Operator + Value Row */}
          <div className="flex items-center gap-2">
            <select
              value={operator}
              onChange={(e) => setOperator(e.target.value)}
              className="h-9 px-2 text-sm border border-slate-200 rounded-lg bg-white focus:border-primary-300 focus:ring-2 focus:ring-primary-100 focus:outline-none"
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
                className="flex-1 h-9 px-3 text-sm border border-slate-200 rounded-lg focus:border-primary-300 focus:ring-2 focus:ring-primary-100 focus:outline-none"
                autoFocus
              />
            )}
          </div>

          {needsTwoValues && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">and</span>
              <input
                type={inputType}
                value={value2}
                onChange={(e) => setValue2(e.target.value)}
                placeholder="Value..."
                className="flex-1 h-9 px-3 text-sm border border-slate-200 rounded-lg focus:border-primary-300 focus:ring-2 focus:ring-primary-100 focus:outline-none"
              />
            </div>
          )}
        </>
      )}

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={!field || (needsValue && !value)}
          className="px-3 py-1.5 text-xs font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-lg transition-colors"
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
  // Convert legacy rules to new format with IDs
  const [filterGroup, setFilterGroup] = useState<FilterGroup>(() =>
    rulesToFilterGroup(rules.map(r => ({ ...r, id: (r as any).id || generateFilterId() })))
  );
  const [editingRule, setEditingRule] = useState<FilterRule | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [showEditor, setShowEditor] = useState(false);

  const getFieldLabel = useCallback(
    (fieldCode: string) => fields.find(f => f.code === fieldCode)?.label || fieldCode,
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
        const fieldLabel = getFieldLabel(node.field);
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
    <div className="h-full flex flex-col bg-slate-50">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-slate-900">Query Builder</h3>
          {hasFilters && (
            <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
              {filterGroup.children.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {hasFilters && (
            <button
              type="button"
              onClick={clearAll}
              className="text-xs text-slate-500 hover:text-danger-600 px-2 py-1 rounded hover:bg-danger-50"
            >
              Clear
            </button>
          )}
          <button type="button" onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Query Preview (like ServiceNow breadcrumb query) */}
      {hasFilters && (
        <div className="px-4 py-2 bg-slate-100 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold text-slate-500 uppercase">Query:</span>
            <code className="flex-1 text-xs text-slate-700 font-mono truncate">
              {queryString}
            </code>
          </div>
        </div>
      )}

      {/* Content - Filter Pills */}
      <div className="flex-1 overflow-y-auto p-4">
        {!hasFilters && !showEditor ? (
          <div className="text-center py-8">
            <p className="text-sm text-slate-500 mb-4">No conditions defined</p>
            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={addCondition}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg shadow-sm"
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
                <span className="text-xs text-slate-500">Match</span>
                <LogicBadge logic={filterGroup.logic} onChange={toggleLogic} />
                <span className="text-xs text-slate-500">of the following:</span>
              </div>
            )}

            {/* Filter Pills Row */}
            <div className="flex flex-wrap items-center gap-2">
              {filterGroup.children.map((node, index) => {
                if (isFilterGroup(node)) {
                  // Nested group - show as grouped pills
                  return (
                    <div
                      key={node.id}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-amber-50 border border-amber-200 rounded-lg"
                    >
                      <Parentheses className="h-3 w-3 text-amber-500" />
                      <span className="text-xs text-amber-700">
                        {node.children.length} conditions ({node.logic})
                      </span>
                      <button
                        type="button"
                        onClick={() => removeRule(index)}
                        className="ml-1 p-0.5 text-amber-400 hover:text-danger-600 rounded"
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
                      fieldLabel={getFieldLabel(node.field)}
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
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-primary-600 border border-dashed border-primary-300 rounded-lg hover:bg-primary-50 transition-colors"
                  >
                    <Plus className="h-3 w-3" />
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={addGroup}
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-amber-600 border border-dashed border-amber-300 rounded-lg hover:bg-amber-50 transition-colors"
                    title="Add grouped conditions (OR)"
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
      <div className="flex items-center justify-between gap-2 px-4 py-3 bg-white border-t border-slate-200">
        <span className="text-xs text-slate-400">
          {hasFilters ? `${filterGroup.children.length} condition${filterGroup.children.length !== 1 ? 's' : ''}` : 'No filters'}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={apply}
            className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg shadow-sm flex items-center gap-1.5 transition-colors"
          >
            <Check className="h-4 w-4" />
            Apply
          </button>
        </div>
      </div>
    </div>
  );
};
