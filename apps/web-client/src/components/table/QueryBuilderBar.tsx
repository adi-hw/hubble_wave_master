import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Plus,
  X,
  Calendar,
  Hash,
  Type,
  ToggleLeft,
  Clock,
  Search,
  Parentheses,
} from 'lucide-react';
import {
  FilterRule,
  FilterGroup,
  FilterNode,
  isFilterGroup,
  generateFilterId,
} from './types';

interface QueryBuilderBarProps {
  fields: { code: string; label: string; type?: string }[];
  filterGroup: FilterGroup;
  onChange: (group: FilterGroup) => void;
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

// Operator definitions with metadata
interface OperatorDef {
  value: string;
  label: string;
  needsValue: boolean;
  description?: string;
}

// Operators based on field type
const getOperatorsForType = (type?: string): OperatorDef[] => {
  const normalizedType = type?.toLowerCase() || 'string';

  // Text/String operators
  const textOperators: OperatorDef[] = [
    { value: 'equals', label: '=', needsValue: true, description: 'Equals exactly' },
    { value: 'not_equals', label: '≠', needsValue: true, description: 'Not equal to' },
    { value: 'contains', label: 'contains', needsValue: true, description: 'Contains text' },
    { value: 'not_contains', label: '!contains', needsValue: true, description: 'Does not contain' },
    { value: 'starts_with', label: 'starts with', needsValue: true, description: 'Starts with' },
    { value: 'ends_with', label: 'ends with', needsValue: true, description: 'Ends with' },
    { value: 'is_empty', label: 'is empty', needsValue: false, description: 'Is empty or null' },
    { value: 'is_not_empty', label: 'is not empty', needsValue: false, description: 'Has a value' },
  ];

  // Number operators
  const numberOperators: OperatorDef[] = [
    { value: 'equals', label: '=', needsValue: true, description: 'Equals' },
    { value: 'not_equals', label: '≠', needsValue: true, description: 'Not equal to' },
    { value: 'greater_than', label: '>', needsValue: true, description: 'Greater than' },
    { value: 'less_than', label: '<', needsValue: true, description: 'Less than' },
    { value: 'greater_or_equal', label: '≥', needsValue: true, description: 'Greater than or equal' },
    { value: 'less_or_equal', label: '≤', needsValue: true, description: 'Less than or equal' },
    { value: 'is_empty', label: 'is empty', needsValue: false, description: 'Is empty or null' },
    { value: 'is_not_empty', label: 'is not empty', needsValue: false, description: 'Has a value' },
  ];

  // Date/DateTime operators
  const dateOperators: OperatorDef[] = [
    { value: 'equals', label: '=', needsValue: true, description: 'On this date' },
    { value: 'not_equals', label: '≠', needsValue: true, description: 'Not on this date' },
    { value: 'before', label: 'before', needsValue: true, description: 'Before date' },
    { value: 'after', label: 'after', needsValue: true, description: 'After date' },
    { value: 'on_or_before', label: 'on or before', needsValue: true, description: 'On or before date' },
    { value: 'on_or_after', label: 'on or after', needsValue: true, description: 'On or after date' },
    { value: 'between', label: 'between', needsValue: true, description: 'Between two dates' },
    { value: 'relative_past', label: 'in the last', needsValue: true, description: 'In the last N days' },
    { value: 'relative_future', label: 'in the next', needsValue: true, description: 'In the next N days' },
    { value: 'today', label: 'is today', needsValue: false, description: 'Is today' },
    { value: 'yesterday', label: 'is yesterday', needsValue: false, description: 'Is yesterday' },
    { value: 'tomorrow', label: 'is tomorrow', needsValue: false, description: 'Is tomorrow' },
    { value: 'this_week', label: 'this week', needsValue: false, description: 'Is within this week' },
    { value: 'last_week', label: 'last week', needsValue: false, description: 'Was last week' },
    { value: 'next_week', label: 'next week', needsValue: false, description: 'Is next week' },
    { value: 'this_month', label: 'this month', needsValue: false, description: 'Is within this month' },
    { value: 'last_month', label: 'last month', needsValue: false, description: 'Was last month' },
    { value: 'next_month', label: 'next month', needsValue: false, description: 'Is next month' },
    { value: 'this_year', label: 'this year', needsValue: false, description: 'Is within this year' },
    { value: 'last_year', label: 'last year', needsValue: false, description: 'Was last year' },
    { value: 'last_7_days', label: 'last 7 days', needsValue: false, description: 'Within last 7 days' },
    { value: 'last_30_days', label: 'last 30 days', needsValue: false, description: 'Within last 30 days' },
    { value: 'last_90_days', label: 'last 90 days', needsValue: false, description: 'Within last 90 days' },
    { value: 'next_7_days', label: 'next 7 days', needsValue: false, description: 'Within next 7 days' },
    { value: 'next_30_days', label: 'next 30 days', needsValue: false, description: 'Within next 30 days' },
    { value: 'is_empty', label: 'is empty', needsValue: false, description: 'Is empty or null' },
    { value: 'is_not_empty', label: 'is not empty', needsValue: false, description: 'Has a value' },
  ];

  // Boolean operators
  const booleanOperators: OperatorDef[] = [
    { value: 'is_true', label: 'is true', needsValue: false, description: 'Is true/yes' },
    { value: 'is_false', label: 'is false', needsValue: false, description: 'Is false/no' },
    { value: 'is_empty', label: 'is empty', needsValue: false, description: 'Is empty or null' },
    { value: 'is_not_empty', label: 'is not empty', needsValue: false, description: 'Has a value' },
  ];

  // Reference/Lookup operators (for foreign keys, relations)
  const referenceOperators: OperatorDef[] = [
    { value: 'equals', label: '=', needsValue: true, description: 'Equals' },
    { value: 'not_equals', label: '≠', needsValue: true, description: 'Not equal to' },
    { value: 'is_empty', label: 'is empty', needsValue: false, description: 'Is empty or null' },
    { value: 'is_not_empty', label: 'is not empty', needsValue: false, description: 'Has a value' },
  ];

  switch (normalizedType) {
    case 'number':
    case 'integer':
    case 'decimal':
    case 'float':
    case 'double':
    case 'currency':
      return numberOperators;
    case 'date':
      return dateOperators;
    case 'datetime':
    case 'timestamp':
    case 'time':
      return dateOperators;
    case 'boolean':
    case 'bool':
    case 'checkbox':
      return booleanOperators;
    case 'reference':
    case 'lookup':
    case 'relation':
    case 'foreignkey':
      return referenceOperators;
    case 'string':
    case 'text':
    case 'email':
    case 'url':
    case 'phone':
    default:
      return textOperators;
  }
};

// Operators that don't need a user-provided value
const operatorNeedsValue = (operator: string): boolean => {
  const noValueOperators = [
    'is_empty', 'is_not_empty', 'is_true', 'is_false',
    'today', 'yesterday', 'tomorrow',
    'this_week', 'last_week', 'next_week',
    'this_month', 'last_month', 'next_month',
    'this_year', 'last_year',
    'last_7_days', 'last_30_days', 'last_90_days',
    'next_7_days', 'next_30_days',
  ];
  return !noValueOperators.includes(operator);
};

// Check if operator needs a second value (for between)
const operatorNeedsSecondValue = (operator: string): boolean => {
  return operator === 'between';
};

// Check if operator is a relative date operator (needs number of days input)
const isRelativeDateOperator = (operator: string): boolean => {
  return operator === 'relative_past' || operator === 'relative_future';
};

// Get display label for an operator
const getOperatorLabel = (operator: string): string => {
  const labels: Record<string, string> = {
    // Text operators
    equals: '=',
    not_equals: '≠',
    contains: 'contains',
    not_contains: '!contains',
    starts_with: 'starts with',
    ends_with: 'ends with',
    // Number operators
    greater_than: '>',
    less_than: '<',
    greater_or_equal: '≥',
    less_or_equal: '≤',
    // Common operators
    is_empty: 'is empty',
    is_not_empty: 'is not empty',
    // Boolean operators
    is_true: 'is true',
    is_false: 'is false',
    // Date operators
    before: 'before',
    after: 'after',
    on_or_before: 'on or before',
    on_or_after: 'on or after',
    between: 'between',
    relative_past: 'in the last',
    relative_future: 'in the next',
    today: 'is today',
    yesterday: 'is yesterday',
    tomorrow: 'is tomorrow',
    this_week: 'this week',
    last_week: 'last week',
    next_week: 'next week',
    this_month: 'this month',
    last_month: 'last month',
    next_month: 'next month',
    this_year: 'this year',
    last_year: 'last year',
    last_7_days: 'last 7 days',
    last_30_days: 'last 30 days',
    last_90_days: 'last 90 days',
    next_7_days: 'next 7 days',
    next_30_days: 'next 30 days',
  };
  return labels[operator] || operator;
};

// Get input type based on field type
const getInputTypeForField = (fieldType?: string): string => {
  const normalizedType = fieldType?.toLowerCase() || 'string';
  switch (normalizedType) {
    case 'number':
    case 'integer':
    case 'decimal':
    case 'float':
    case 'double':
    case 'currency':
      return 'number';
    case 'date':
      return 'date';
    case 'datetime':
    case 'timestamp':
      return 'datetime-local';
    case 'time':
      return 'time';
    case 'email':
      return 'email';
    case 'url':
      return 'url';
    default:
      return 'text';
  }
};

// Format display value for filters
const formatFilterValue = (operator: string, value: any, value2?: any): string => {
  if (!operatorNeedsValue(operator)) return '';

  // Between operator
  if (operator === 'between' && value && value2) {
    return `"${value}" and "${value2}"`;
  }

  // Relative date operators (stored as "N:unit")
  if (isRelativeDateOperator(operator) && value) {
    const [num, unit] = String(value).split(':');
    return `${num} ${unit || 'days'}`;
  }

  return `"${value}"`;
};

// Build query string for display
const buildQueryString = (
  node: FilterNode,
  getFieldLabel: (code: string) => string
): string => {
  if (isFilterGroup(node)) {
    if (node.children.length === 0) return '';
    const parts = node.children.map(child => buildQueryString(child, getFieldLabel)).filter(Boolean);
    if (parts.length === 0) return '';
    if (parts.length === 1) return parts[0];
    return `(${parts.join(` ${node.logic} `)})`;
  } else {
    const fieldLabel = getFieldLabel(node.field);
    const op = getOperatorLabel(node.operator);
    const val = formatFilterValue(node.operator, node.value, node.value2);
    return `${fieldLabel} ${op} ${val}`.trim();
  }
};

// Inline dropdown for adding/editing filter
interface FilterDropdownProps {
  fields: { code: string; label: string; type?: string }[];
  rule: FilterRule | null;
  onSave: (rule: FilterRule) => void;
  onCancel: () => void;
}

const FilterDropdown: React.FC<FilterDropdownProps> = ({ fields, rule, onSave, onCancel }) => {
  // Parse relative date value if editing existing rule
  const parseRelativeValue = (ruleValue: string | undefined): { num: string; unit: 'days' | 'weeks' | 'months' } => {
    if (!ruleValue) return { num: '', unit: 'days' };
    const [num, unit] = String(ruleValue).split(':');
    return { num, unit: (unit as 'days' | 'weeks' | 'months') || 'days' };
  };

  const initialRelative = rule && isRelativeDateOperator(rule.operator) ? parseRelativeValue(rule.value) : { num: '', unit: 'days' as const };

  const [field, setField] = useState(rule?.field || '');
  const [operator, setOperator] = useState(rule?.operator || 'contains');
  const [value, setValue] = useState(
    rule && isRelativeDateOperator(rule.operator) ? initialRelative.num : (rule?.value || '')
  );
  const [value2, setValue2] = useState(rule?.value2 || ''); // For "between" operator
  const [relativeUnit, setRelativeUnit] = useState<'days' | 'weeks' | 'months'>(initialRelative.unit);
  const [step, setStep] = useState<'field' | 'operator' | 'value'>(rule?.field ? 'operator' : 'field');
  const [fieldSearch, setFieldSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedField = fields.find(f => f.code === field);
  const operators = getOperatorsForType(selectedField?.type);
  const needsValue = operatorNeedsValue(operator);
  const needsSecondValue = operatorNeedsSecondValue(operator);
  const isRelativeDate = isRelativeDateOperator(operator);
  const inputType = getInputTypeForField(selectedField?.type);

  const filteredFields = fields.filter(
    f => f.label.toLowerCase().includes(fieldSearch.toLowerCase()) ||
         f.code.toLowerCase().includes(fieldSearch.toLowerCase())
  );

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        onCancel();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onCancel]);

  const handleFieldSelect = (fieldCode: string) => {
    setField(fieldCode);
    const fieldType = fields.find(f => f.code === fieldCode)?.type;
    const ops = getOperatorsForType(fieldType);
    setOperator(ops[0].value);
    setValue(''); // Reset value when field changes
    setValue2('');
    setStep('operator');
  };

  const handleOperatorSelect = (op: string) => {
    setOperator(op);
    setValue('');
    setValue2('');
    if (!operatorNeedsValue(op)) {
      onSave({
        id: rule?.id || generateFilterId(),
        field,
        operator: op,
        value: '',
      });
    } else {
      setStep('value');
    }
  };

  const handleSave = () => {
    if (!field) return;

    // For relative date operators, store value with unit (e.g., "7:days")
    let finalValue = value;
    if (isRelativeDate && value) {
      finalValue = `${value}:${relativeUnit}`;
    }

    onSave({
      id: rule?.id || generateFilterId(),
      field,
      operator,
      value: needsValue ? finalValue : '',
      value2: needsSecondValue ? value2 : undefined,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && field && (!needsValue || value) && (!needsSecondValue || value2)) {
      handleSave();
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  // Get placeholder text based on field type and operator
  const getPlaceholder = () => {
    if (isRelativeDate) {
      return 'Number of days';
    }
    const fieldType = selectedField?.type?.toLowerCase();
    switch (fieldType) {
      case 'date':
        return 'Select a date';
      case 'datetime':
      case 'timestamp':
        return 'Select date and time';
      case 'number':
      case 'integer':
      case 'decimal':
        return 'Enter a number';
      case 'email':
        return 'Enter email address';
      case 'url':
        return 'Enter URL';
      default:
        return 'Enter value...';
    }
  };

  // Check if form is valid for saving
  const canSave = () => {
    if (!field) return false;
    if (!needsValue) return true;
    if (!value) return false;
    if (needsSecondValue && !value2) return false;
    return true;
  };

  return (
    <div
      ref={dropdownRef}
      className="bg-white border border-slate-200 rounded-lg shadow-xl min-w-[320px] overflow-hidden"
      onClick={(e) => e.stopPropagation()}
    >
      {step === 'field' && (
        <div className="p-3">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Select Field</div>
          <div className="relative mb-2">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={fieldSearch}
              onChange={(e) => setFieldSearch(e.target.value)}
              placeholder="Search fields..."
              className="w-full h-8 pl-8 pr-3 text-sm border border-slate-200 rounded-md focus:border-primary-300 focus:ring-1 focus:ring-primary-100 focus:outline-none"
              autoFocus
            />
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filteredFields.map(f => {
              const Icon = getFieldIcon(f.type);
              return (
                <button
                  key={f.code}
                  type="button"
                  onClick={() => handleFieldSelect(f.code)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50 rounded-md transition-colors"
                >
                  <Icon className="h-4 w-4 text-slate-400" />
                  <span className="truncate flex-1 text-left">{f.label}</span>
                  <span className="text-[10px] text-slate-400 uppercase">{f.type || 'text'}</span>
                </button>
              );
            })}
            {filteredFields.length === 0 && (
              <div className="px-2 py-4 text-sm text-slate-400 text-center">
                No fields found
              </div>
            )}
          </div>
        </div>
      )}

      {step === 'operator' && (
        <div className="p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Select Operator</div>
            <button
              type="button"
              onClick={() => setStep('field')}
              className="text-xs text-primary-600 hover:underline"
            >
              ← Back
            </button>
          </div>
          <div className="flex items-center gap-2 px-2 py-1.5 mb-3 bg-slate-50 rounded-md">
            {(() => {
              const Icon = getFieldIcon(selectedField?.type);
              return <Icon className="h-4 w-4 text-slate-400" />;
            })()}
            <span className="text-sm font-medium text-slate-700">{selectedField?.label}</span>
            <span className="text-[10px] text-slate-400 uppercase ml-auto">{selectedField?.type || 'text'}</span>
          </div>
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {operators.map(op => (
              <button
                key={op.value}
                type="button"
                onClick={() => handleOperatorSelect(op.value)}
                className={`w-full flex items-center justify-between px-3 py-2 text-sm rounded-md transition-colors ${
                  operator === op.value
                    ? 'bg-primary-100 text-primary-700'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
                title={op.description}
              >
                <span className="font-medium">{op.label}</span>
                {op.description && (
                  <span className="text-xs text-slate-400">{op.description}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 'value' && (
        <div className="p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              {needsSecondValue ? 'Enter Date Range' : isRelativeDate ? 'Enter Time Period' : 'Enter Value'}
            </div>
            <button
              type="button"
              onClick={() => setStep('operator')}
              className="text-xs text-primary-600 hover:underline"
            >
              ← Back
            </button>
          </div>
          <div className="flex items-center gap-2 px-2 py-1.5 mb-3 bg-slate-50 rounded-md">
            <span className="text-sm font-medium text-slate-700">{selectedField?.label}</span>
            <span className="px-1.5 py-0.5 text-xs bg-slate-200 text-slate-600 rounded">{getOperatorLabel(operator)}</span>
          </div>

          {/* Between operator - two date inputs */}
          {needsSecondValue && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 w-12">From:</span>
                <input
                  type={inputType}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Start date"
                  className="flex-1 h-9 px-3 text-sm border border-slate-200 rounded-md focus:border-primary-300 focus:ring-1 focus:ring-primary-100 focus:outline-none"
                  autoFocus
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 w-12">To:</span>
                <input
                  type={inputType}
                  value={value2}
                  onChange={(e) => setValue2(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="End date"
                  className="flex-1 h-9 px-3 text-sm border border-slate-200 rounded-md focus:border-primary-300 focus:ring-1 focus:ring-primary-100 focus:outline-none"
                />
              </div>
              <button
                type="button"
                onClick={handleSave}
                disabled={!canSave()}
                className="w-full h-9 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:bg-slate-300 rounded-md transition-colors"
              >
                {rule ? 'Update' : 'Add'}
              </button>
            </div>
          )}

          {/* Relative date operator - number input with unit selector */}
          {isRelativeDate && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Enter number"
                  className="w-24 h-9 px-3 text-sm border border-slate-200 rounded-md focus:border-primary-300 focus:ring-1 focus:ring-primary-100 focus:outline-none"
                  autoFocus
                />
                <select
                  value={relativeUnit}
                  onChange={(e) => setRelativeUnit(e.target.value as 'days' | 'weeks' | 'months')}
                  className="flex-1 h-9 px-3 text-sm border border-slate-200 rounded-md focus:border-primary-300 focus:ring-1 focus:ring-primary-100 focus:outline-none bg-white"
                >
                  <option value="days">days</option>
                  <option value="weeks">weeks</option>
                  <option value="months">months</option>
                </select>
              </div>
              <div className="text-xs text-slate-500 px-1">
                {operator === 'relative_past'
                  ? `Filter items from the last ${value || 'N'} ${relativeUnit}`
                  : `Filter items in the next ${value || 'N'} ${relativeUnit}`}
              </div>
              <button
                type="button"
                onClick={handleSave}
                disabled={!canSave()}
                className="w-full h-9 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:bg-slate-300 rounded-md transition-colors"
              >
                {rule ? 'Update' : 'Add'}
              </button>
            </div>
          )}

          {/* Standard value input */}
          {!needsSecondValue && !isRelativeDate && (
            <div className="flex items-center gap-2">
              <input
                type={inputType}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={getPlaceholder()}
                step={inputType === 'number' ? 'any' : undefined}
                className="flex-1 h-9 px-3 text-sm border border-slate-200 rounded-md focus:border-primary-300 focus:ring-1 focus:ring-primary-100 focus:outline-none"
                autoFocus
              />
              <button
                type="button"
                onClick={handleSave}
                disabled={!canSave()}
                className="h-9 px-4 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:bg-slate-300 rounded-md transition-colors"
              >
                {rule ? 'Update' : 'Add'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Filter Pill Component
interface FilterPillProps {
  rule: FilterRule;
  fieldLabel: string;
  onRemove: () => void;
  onEdit: () => void;
}

const FilterPill: React.FC<FilterPillProps> = ({ rule, fieldLabel, onRemove, onEdit }) => {
  const needsValue = operatorNeedsValue(rule.operator);

  // Format the display value based on operator type
  const getDisplayValue = () => {
    if (!needsValue) return null;

    // Between operator - show "From X to Y"
    if (rule.operator === 'between' && rule.value && rule.value2) {
      return (
        <span className="font-medium text-primary-800">
          "{rule.value}" to "{rule.value2}"
        </span>
      );
    }

    // Relative date operators - show "N days/weeks/months"
    if (isRelativeDateOperator(rule.operator) && rule.value) {
      const [num, unit] = String(rule.value).split(':');
      return (
        <span className="font-medium text-primary-800">
          {num} {unit || 'days'}
        </span>
      );
    }

    // Standard value display
    if (rule.value) {
      return <span className="font-medium text-primary-800">"{rule.value}"</span>;
    }

    return <span className="font-medium text-primary-400">?</span>;
  };

  return (
    <div
      onClick={onEdit}
      className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary-50 border border-primary-200 rounded-md text-xs cursor-pointer hover:bg-primary-100 hover:border-primary-300 transition-all group"
    >
      <span className="font-semibold text-primary-700">{fieldLabel}</span>
      <span className="text-primary-500">{getOperatorLabel(rule.operator)}</span>
      {getDisplayValue()}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="ml-0.5 p-0.5 text-primary-400 hover:text-danger-600 rounded-sm opacity-60 group-hover:opacity-100 transition-opacity"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
};

// Logic Toggle Badge
interface LogicToggleProps {
  logic: 'AND' | 'OR';
  onChange: (logic: 'AND' | 'OR') => void;
  size?: 'sm' | 'md';
}

const LogicToggle: React.FC<LogicToggleProps> = ({ logic, onChange, size = 'sm' }) => (
  <button
    type="button"
    onClick={(e) => {
      e.stopPropagation();
      onChange(logic === 'AND' ? 'OR' : 'AND');
    }}
    className={`
      font-bold uppercase tracking-wide rounded transition-colors
      ${size === 'sm' ? 'px-1.5 py-0.5 text-[9px]' : 'px-2 py-0.5 text-[10px]'}
      ${logic === 'AND'
        ? 'bg-slate-200 text-slate-600 hover:bg-slate-300'
        : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
      }
    `}
    title={`Click to switch to ${logic === 'AND' ? 'OR' : 'AND'}`}
  >
    {logic}
  </button>
);

// Group Pill Component - displays a nested group
interface GroupPillProps {
  group: FilterGroup;
  getFieldLabel: (code: string) => string;
  onRemove: () => void;
  onEdit: () => void;
  onLogicChange: (logic: 'AND' | 'OR') => void;
}

const GroupPill: React.FC<GroupPillProps> = ({ group, getFieldLabel, onRemove, onEdit, onLogicChange }) => {
  const conditionCount = group.children.length;

  return (
    <div
      onClick={onEdit}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 border border-amber-200 rounded-md text-xs cursor-pointer hover:bg-amber-100 hover:border-amber-300 transition-all group"
    >
      <Parentheses className="h-3 w-3 text-amber-500" />
      <div className="flex items-center gap-1">
        {group.children.slice(0, 2).map((child, idx) => {
          if (isFilterGroup(child)) {
            return (
              <span key={child.id} className="text-amber-600">
                {idx > 0 && <span className="mx-0.5">{group.logic}</span>}
                (group)
              </span>
            );
          }
          return (
            <span key={child.id} className="text-amber-700">
              {idx > 0 && <span className="text-amber-500 mx-0.5">{group.logic}</span>}
              <span className="font-medium">{getFieldLabel(child.field)}</span>
            </span>
          );
        })}
        {conditionCount > 2 && (
          <span className="text-amber-500">+{conditionCount - 2}</span>
        )}
      </div>
      <LogicToggle logic={group.logic} onChange={onLogicChange} size="sm" />
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="ml-0.5 p-0.5 text-amber-400 hover:text-danger-600 rounded-sm opacity-60 group-hover:opacity-100 transition-opacity"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
};

// Recursive Node Renderer
interface NodeRendererProps {
  node: FilterNode;
  index: number;
  parentLogic: 'AND' | 'OR';
  isFirst: boolean;
  getFieldLabel: (code: string) => string;
  onRemove: () => void;
  onEdit: () => void;
  onLogicChange: (logic: 'AND' | 'OR') => void;
  onParentLogicChange: (logic: 'AND' | 'OR') => void;
}

const NodeRenderer: React.FC<NodeRendererProps> = ({
  node,
  isFirst,
  parentLogic,
  getFieldLabel,
  onRemove,
  onEdit,
  onLogicChange,
  onParentLogicChange,
}) => {
  return (
    <>
      {!isFirst && (
        <LogicToggle logic={parentLogic} onChange={onParentLogicChange} size="md" />
      )}
      {isFilterGroup(node) ? (
        <GroupPill
          group={node}
          getFieldLabel={getFieldLabel}
          onRemove={onRemove}
          onEdit={onEdit}
          onLogicChange={onLogicChange}
        />
      ) : (
        <FilterPill
          rule={node}
          fieldLabel={getFieldLabel(node.field)}
          onRemove={onRemove}
          onEdit={onEdit}
        />
      )}
    </>
  );
};

// Group Editor Modal
interface GroupEditorProps {
  fields: { code: string; label: string; type?: string }[];
  group: FilterGroup;
  getFieldLabel: (code: string) => string;
  onSave: (group: FilterGroup) => void;
  onCancel: () => void;
}

const GroupEditor: React.FC<GroupEditorProps> = ({ fields, group, getFieldLabel, onSave, onCancel }) => {
  const [localGroup, setLocalGroup] = useState<FilterGroup>({ ...group });
  const [showAddDropdown, setShowAddDropdown] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onCancel();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onCancel]);

  const addCondition = (rule: FilterRule) => {
    setLocalGroup(prev => ({
      ...prev,
      children: [...prev.children, rule],
    }));
    setShowAddDropdown(false);
  };

  const updateCondition = (index: number, rule: FilterRule) => {
    setLocalGroup(prev => ({
      ...prev,
      children: prev.children.map((c, i) => i === index ? rule : c),
    }));
    setEditingIndex(null);
  };

  const removeCondition = (index: number) => {
    setLocalGroup(prev => ({
      ...prev,
      children: prev.children.filter((_, i) => i !== index),
    }));
  };

  const toggleLogic = () => {
    setLocalGroup(prev => ({
      ...prev,
      logic: prev.logic === 'AND' ? 'OR' : 'AND',
    }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div
        ref={modalRef}
        className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2">
            <Parentheses className="h-4 w-4 text-amber-500" />
            <h3 className="text-sm font-semibold text-slate-900">Edit Group</h3>
          </div>
          <button type="button" onClick={onCancel} className="p-1 text-slate-400 hover:text-slate-600">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Logic Toggle */}
        <div className="px-4 py-3 bg-slate-50/50 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Match</span>
            <LogicToggle logic={localGroup.logic} onChange={toggleLogic} size="md" />
            <span className="text-xs text-slate-500">of the following conditions:</span>
          </div>
        </div>

        {/* Conditions */}
        <div className="p-4 max-h-64 overflow-y-auto">
          {localGroup.children.length === 0 ? (
            <div className="text-center py-6 text-sm text-slate-400">
              No conditions in this group
            </div>
          ) : (
            <div className="space-y-2">
              {localGroup.children.map((child, index) => {
                if (isFilterGroup(child)) {
                  return (
                    <div key={child.id} className="flex items-center gap-2 p-2 bg-amber-50 rounded-lg">
                      <Parentheses className="h-4 w-4 text-amber-500" />
                      <span className="text-sm text-amber-700">Nested group ({child.children.length} conditions)</span>
                      <button
                        type="button"
                        onClick={() => removeCondition(index)}
                        className="ml-auto p-1 text-amber-400 hover:text-danger-600"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  );
                }

                return (
                  <div key={child.id} className="flex items-center gap-2">
                    {index > 0 && (
                      <span className="text-[10px] font-bold text-slate-400 uppercase w-8">
                        {localGroup.logic}
                      </span>
                    )}
                    {index === 0 && <span className="w-8" />}
                    {editingIndex === index ? (
                      <div className="flex-1">
                        <FilterDropdown
                          fields={fields}
                          rule={child}
                          onSave={(r) => updateCondition(index, r)}
                          onCancel={() => setEditingIndex(null)}
                        />
                      </div>
                    ) : (
                      <div
                        onClick={() => setEditingIndex(index)}
                        className="flex-1 flex items-center gap-2 p-2 bg-slate-50 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors group"
                      >
                        <span className="font-medium text-sm text-slate-700">{getFieldLabel(child.field)}</span>
                        <span className="text-xs text-slate-500">{getOperatorLabel(child.operator)}</span>
                        {operatorNeedsValue(child.operator) && (
                          child.operator === 'between' && child.value2
                            ? <span className="text-sm text-slate-800">"{child.value}" to "{child.value2}"</span>
                            : isRelativeDateOperator(child.operator)
                              ? <span className="text-sm text-slate-800">{formatFilterValue(child.operator, child.value)}</span>
                              : <span className="text-sm text-slate-800">"{child.value}"</span>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeCondition(index);
                          }}
                          className="ml-auto p-1 text-slate-300 hover:text-danger-600 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Add Condition Button */}
          {showAddDropdown ? (
            <div className="mt-3">
              <FilterDropdown
                fields={fields}
                rule={null}
                onSave={addCondition}
                onCancel={() => setShowAddDropdown(false)}
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowAddDropdown(true)}
              className="mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-500 border border-dashed border-slate-300 rounded-lg hover:text-primary-600 hover:border-primary-300 hover:bg-primary-50 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Add condition to group
            </button>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-slate-200 bg-slate-50">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSave(localGroup)}
            disabled={localGroup.children.length === 0}
            className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:bg-slate-300 rounded-lg transition-colors"
          >
            Save Group
          </button>
        </div>
      </div>
    </div>
  );
};

export const QueryBuilderBar: React.FC<QueryBuilderBarProps> = ({
  fields,
  filterGroup,
  onChange,
}) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingGroup, setEditingGroup] = useState<{ index: number; group: FilterGroup } | null>(null);

  const getFieldLabel = useCallback(
    (fieldCode: string) => fields.find(f => f.code === fieldCode)?.label || fieldCode,
    [fields]
  );

  const addCondition = (rule: FilterRule) => {
    onChange({
      ...filterGroup,
      children: [...filterGroup.children, rule],
    });
    setShowDropdown(false);
  };

  const addGroup = () => {
    const newGroup: FilterGroup = {
      id: generateFilterId(),
      type: 'group',
      logic: 'OR',
      children: [],
    };
    setEditingGroup({ index: -1, group: newGroup });
  };

  const saveGroup = (group: FilterGroup) => {
    if (editingGroup!.index === -1) {
      // New group
      onChange({
        ...filterGroup,
        children: [...filterGroup.children, group],
      });
    } else {
      // Update existing group
      onChange({
        ...filterGroup,
        children: filterGroup.children.map((c, i) => i === editingGroup!.index ? group : c),
      });
    }
    setEditingGroup(null);
  };

  const updateCondition = (index: number, rule: FilterRule) => {
    onChange({
      ...filterGroup,
      children: filterGroup.children.map((c, i) => i === index ? rule : c),
    });
    setEditingIndex(null);
    setShowDropdown(false);
  };

  const removeCondition = (index: number) => {
    onChange({
      ...filterGroup,
      children: filterGroup.children.filter((_, i) => i !== index),
    });
  };

  const toggleRootLogic = () => {
    onChange({
      ...filterGroup,
      logic: filterGroup.logic === 'AND' ? 'OR' : 'AND',
    });
  };

  const toggleChildGroupLogic = (index: number) => {
    const child = filterGroup.children[index];
    if (isFilterGroup(child)) {
      onChange({
        ...filterGroup,
        children: filterGroup.children.map((c, i) =>
          i === index && isFilterGroup(c)
            ? { ...c, logic: c.logic === 'AND' ? 'OR' : 'AND' }
            : c
        ),
      });
    }
  };

  const clearAll = () => {
    onChange({ id: 'root', type: 'group', logic: 'AND', children: [] });
  };

  const hasFilters = filterGroup.children.length > 0;
  const queryString = buildQueryString(filterGroup, getFieldLabel);

  return (
    <div
      className="relative"
      style={{
        backgroundColor: 'var(--bg-elevated)',
        borderBottom: '1px solid var(--border-subtle)',
      }}
    >
      {/* Main bar */}
      <div className="flex items-center gap-2 px-4 py-2 flex-wrap">
        {/* Label */}
        <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
          Filter
        </span>

        {/* Filter Nodes */}
        {hasFilters && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {filterGroup.children.map((node, index) => (
              <NodeRenderer
                key={isFilterGroup(node) ? node.id : node.id}
                node={node}
                index={index}
                parentLogic={filterGroup.logic}
                isFirst={index === 0}
                getFieldLabel={getFieldLabel}
                onRemove={() => removeCondition(index)}
                onEdit={() => {
                  if (isFilterGroup(node)) {
                    setEditingGroup({ index, group: node });
                  } else {
                    setEditingIndex(index);
                    setShowDropdown(true);
                  }
                }}
                onLogicChange={() => toggleChildGroupLogic(index)}
                onParentLogicChange={toggleRootLogic}
              />
            ))}
          </div>
        )}

        {/* Add Buttons */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              setEditingIndex(null);
              setShowDropdown(true);
            }}
            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-500 border border-dashed border-slate-300 rounded-md hover:text-primary-600 hover:border-primary-400 hover:bg-primary-50 transition-colors"
            title="Add condition"
          >
            <Plus className="h-3 w-3" />
            <span className="hidden sm:inline">Condition</span>
          </button>
          <button
            type="button"
            onClick={addGroup}
            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-amber-600 border border-dashed border-amber-300 rounded-md hover:border-amber-400 hover:bg-amber-50 transition-colors"
            title="Add group (for nested conditions)"
          >
            <Parentheses className="h-3 w-3" />
            <span className="hidden sm:inline">Group</span>
          </button>
        </div>

        {/* Clear All */}
        {hasFilters && (
          <button
            type="button"
            onClick={clearAll}
            className="ml-auto text-[11px] transition-colors"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-danger)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
          >
            Clear all
          </button>
        )}
      </div>

      {/* Query Preview */}
      {hasFilters && queryString && (
        <div
          className="px-4 py-1.5"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderTop: '1px solid var(--border-subtle)',
          }}
        >
          <code className="text-[11px] font-mono" style={{ color: 'var(--text-secondary)' }}>
            {queryString}
          </code>
        </div>
      )}

      {/* Dropdown for adding/editing conditions */}
      {showDropdown && (
        <div className="absolute top-full left-4 mt-1 z-50">
          <FilterDropdown
            fields={fields}
            rule={editingIndex !== null ? (filterGroup.children[editingIndex] as FilterRule) : null}
            onSave={(rule) => {
              if (editingIndex !== null) {
                updateCondition(editingIndex, rule);
              } else {
                addCondition(rule);
              }
            }}
            onCancel={() => {
              setShowDropdown(false);
              setEditingIndex(null);
            }}
          />
        </div>
      )}

      {/* Group Editor Modal */}
      {editingGroup && (
        <GroupEditor
          fields={fields}
          group={editingGroup.group}
          getFieldLabel={getFieldLabel}
          onSave={saveGroup}
          onCancel={() => setEditingGroup(null)}
        />
      )}
    </div>
  );
};
