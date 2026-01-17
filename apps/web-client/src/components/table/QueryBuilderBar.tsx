/**
 * QueryBuilderBar Component
 *
 * A theme-aware, accessible query builder interface for constructing complex filter conditions.
 * This component supports nested filter groups with AND/OR logic, various field types, and operators.
 *
 * Theme Integration:
 * - Uses Tailwind CSS classes for all colors and shadows
 * - Supports light/dark mode through Tailwind theme switching
 * - Maintains consistent visual hierarchy across theme changes
 *
 * Accessibility Features:
 * - ARIA labels for screen reader support
 * - Keyboard navigation (Enter to confirm, Escape to cancel)
 * - Minimum 44px touch targets for mobile accessibility
 * - Semantic HTML structure with proper roles
 * - Focus management for dropdowns and modals
 *
 * @component
 */

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
  getPropertyLabel: (code: string) => string
): string => {
  if (isFilterGroup(node)) {
    if (node.children.length === 0) return '';
    const parts = node.children.map(child => buildQueryString(child, getPropertyLabel)).filter(Boolean);
    if (parts.length === 0) return '';
    if (parts.length === 1) return parts[0];
    return `(${parts.join(` ${node.logic} `)})`;
  } else {
    const fieldLabel = getPropertyLabel(node.field);
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

  const handlePropertySelect = (propertyCode: string) => {
    setField(propertyCode);
    const fieldType = fields.find(f => f.code === propertyCode)?.type;
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
      role="dialog"
      aria-label="Filter builder dialog"
      className="rounded-lg min-w-[320px] overflow-hidden bg-card border border-border shadow-xl"
      onClick={(e) => e.stopPropagation()}
    >
      {step === 'field' && (
        <div className="p-3">
          <div className="text-xs font-semibold uppercase tracking-wide mb-2 text-muted-foreground">
            Select Field
          </div>
          <div className="relative mb-2">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              value={fieldSearch}
              onChange={(e) => setFieldSearch(e.target.value)}
              placeholder="Search fields..."
              aria-label="Search fields"
              className="w-full h-8 pl-8 pr-3 text-sm rounded-md focus:ring-1 focus:outline-none border border-border bg-card text-foreground focus:border-primary focus:ring-primary/20"
              autoFocus
            />
          </div>
          <div className="max-h-48 overflow-y-auto" role="listbox" aria-label="Available fields">
            {filteredFields.map(f => {
              const Icon = getFieldIcon(f.type);
              return (
                <button
                  key={f.code}
                  type="button"
                  role="option"
                  aria-label={`Select ${f.label} field`}
                  onClick={() => handlePropertySelect(f.code)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 min-h-[44px] text-sm rounded-md transition-colors text-muted-foreground hover:bg-muted"
                >
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <span className="truncate flex-1 text-left">{f.label}</span>
                  <span className="text-[10px] uppercase text-muted-foreground">
                    {f.type || 'text'}
                  </span>
                </button>
              );
            })}
            {filteredFields.length === 0 && (
              <div className="px-2 py-4 text-sm text-center text-muted-foreground">
                No fields found
              </div>
            )}
          </div>
        </div>
      )}

      {step === 'operator' && (
        <div className="p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Select Operator
            </div>
            <button
              type="button"
              onClick={() => setStep('field')}
              aria-label="Go back to field selection"
              className="text-xs hover:underline text-primary"
            >
              ← Back
            </button>
          </div>
          <div className="flex items-center gap-2 px-2 py-1.5 mb-3 rounded-md bg-muted">
            {(() => {
              const Icon = getFieldIcon(selectedField?.type);
              return <Icon className="h-4 w-4 text-muted-foreground" />;
            })()}
            <span className="text-sm font-medium text-muted-foreground">
              {selectedField?.label}
            </span>
            <span className="text-[10px] uppercase ml-auto text-muted-foreground">
              {selectedField?.type || 'text'}
            </span>
          </div>
          <div className="space-y-1 max-h-64 overflow-y-auto" role="listbox" aria-label="Available operators">
            {operators.map(op => (
              <button
                key={op.value}
                type="button"
                role="option"
                aria-label={`Select ${op.label} operator${op.description ? `: ${op.description}` : ''}`}
                aria-selected={operator === op.value}
                onClick={() => handleOperatorSelect(op.value)}
                className={`w-full flex items-center justify-between px-3 py-2 min-h-[44px] text-sm rounded-md transition-colors ${
                  operator === op.value
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted'
                }`}
                title={op.description}
              >
                <span className="font-medium">{op.label}</span>
                {op.description && (
                  <span className="text-xs text-muted-foreground">
                    {op.description}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 'value' && (
        <div className="p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {needsSecondValue ? 'Enter Date Range' : isRelativeDate ? 'Enter Time Period' : 'Enter Value'}
            </div>
            <button
              type="button"
              onClick={() => setStep('operator')}
              aria-label="Go back to operator selection"
              className="text-xs hover:underline text-primary"
            >
              ← Back
            </button>
          </div>
          <div className="flex items-center gap-2 px-2 py-1.5 mb-3 rounded-md bg-muted">
            <span className="text-sm font-medium text-muted-foreground">
              {selectedField?.label}
            </span>
            <span className="px-1.5 py-0.5 text-xs rounded bg-accent text-muted-foreground">
              {getOperatorLabel(operator)}
            </span>
          </div>

          {/* Between operator - two date inputs */}
          {needsSecondValue && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs w-12 text-muted-foreground">From:</span>
                <input
                  type={inputType}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Start date"
                  aria-label="Start date"
                  className="flex-1 h-9 px-3 text-sm rounded-md focus:ring-1 focus:outline-none border border-border bg-card text-foreground focus:border-primary focus:ring-primary/20"
                  autoFocus
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs w-12 text-muted-foreground">To:</span>
                <input
                  type={inputType}
                  value={value2}
                  onChange={(e) => setValue2(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="End date"
                  aria-label="End date"
                  className="flex-1 h-9 px-3 text-sm rounded-md focus:ring-1 focus:outline-none border border-border bg-card text-foreground focus:border-primary focus:ring-primary/20"
                />
              </div>
              <button
                type="button"
                onClick={handleSave}
                disabled={!canSave()}
                aria-label={rule ? 'Update filter' : 'Add filter'}
                className={`w-full h-9 min-h-[44px] text-sm font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  canSave()
                    ? 'bg-primary text-primary-foreground hover:opacity-90'
                    : 'bg-muted text-muted-foreground'
                }`}
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
                  aria-label="Number of time units"
                  className="w-24 h-9 px-3 text-sm rounded-md focus:ring-1 focus:outline-none border border-border bg-card text-foreground focus:border-primary focus:ring-primary/20"
                  autoFocus
                />
                <select
                  value={relativeUnit}
                  onChange={(e) => setRelativeUnit(e.target.value as 'days' | 'weeks' | 'months')}
                  aria-label="Time unit"
                  className="flex-1 h-9 px-3 text-sm rounded-md focus:ring-1 focus:outline-none border border-border bg-card text-foreground focus:border-primary focus:ring-primary/20"
                >
                  <option value="days">days</option>
                  <option value="weeks">weeks</option>
                  <option value="months">months</option>
                </select>
              </div>
              <div className="text-xs px-1 text-muted-foreground">
                {operator === 'relative_past'
                  ? `Filter items from the last ${value || 'N'} ${relativeUnit}`
                  : `Filter items in the next ${value || 'N'} ${relativeUnit}`}
              </div>
              <button
                type="button"
                onClick={handleSave}
                disabled={!canSave()}
                aria-label={rule ? 'Update filter' : 'Add filter'}
                className={`w-full h-9 min-h-[44px] text-sm font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  canSave()
                    ? 'bg-primary text-primary-foreground hover:opacity-90'
                    : 'bg-muted text-muted-foreground'
                }`}
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
                aria-label="Filter value"
                step={inputType === 'number' ? 'any' : undefined}
                className="flex-1 h-9 px-3 text-sm rounded-md focus:ring-1 focus:outline-none border border-border bg-card text-foreground focus:border-primary focus:ring-primary/20"
                autoFocus
              />
              <button
                type="button"
                onClick={handleSave}
                disabled={!canSave()}
                aria-label={rule ? 'Update filter' : 'Add filter'}
                className={`h-9 min-h-[44px] px-4 text-sm font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  canSave()
                    ? 'bg-primary text-primary-foreground hover:opacity-90'
                    : 'bg-muted text-muted-foreground'
                }`}
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
        <span className="font-medium text-primary">
          "{rule.value}" to "{rule.value2}"
        </span>
      );
    }

    // Relative date operators - show "N days/weeks/months"
    if (isRelativeDateOperator(rule.operator) && rule.value) {
      const [num, unit] = String(rule.value).split(':');
      return (
        <span className="font-medium text-primary">
          {num} {unit || 'days'}
        </span>
      );
    }

    // Standard value display
    if (rule.value) {
      return <span className="font-medium text-primary">"{rule.value}"</span>;
    }

    return <span className="font-medium text-muted-foreground">?</span>;
  };

  return (
    <div
      onClick={onEdit}
      role="button"
      aria-label={`Edit filter: ${fieldLabel} ${getOperatorLabel(rule.operator)} ${rule.value || ''}`}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onEdit();
        }
      }}
      className="inline-flex items-center gap-1 px-2.5 py-1 min-h-[44px] rounded-md text-xs cursor-pointer transition-all group bg-primary/10 border border-primary hover:bg-accent"
    >
      <span className="font-semibold text-primary">
        {fieldLabel}
      </span>
      <span className="text-primary">
        {getOperatorLabel(rule.operator)}
      </span>
      {getDisplayValue()}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        aria-label={`Remove filter: ${fieldLabel}`}
        className="ml-0.5 p-0.5 rounded-sm opacity-60 group-hover:opacity-100 transition-opacity text-primary hover:text-destructive"
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
    role="switch"
    aria-checked={logic === 'OR'}
    aria-label={`Toggle between AND and OR logic. Currently set to ${logic}`}
    className={`font-bold uppercase tracking-wide rounded transition-colors min-h-[44px] hover:opacity-80 ${
      size === 'sm' ? 'px-1.5 py-0.5 text-[9px]' : 'px-2 py-0.5 text-[10px]'
    } ${
      logic === 'AND'
        ? 'bg-accent text-muted-foreground'
        : 'bg-warning-subtle text-warning-text'
    }`}
    title={`Click to switch to ${logic === 'AND' ? 'OR' : 'AND'}`}
  >
    {logic}
  </button>
);

// Group Pill Component - displays a nested group
interface GroupPillProps {
  group: FilterGroup;
  getPropertyLabel: (code: string) => string;
  onRemove: () => void;
  onEdit: () => void;
  onLogicChange: (logic: 'AND' | 'OR') => void;
}

const GroupPill: React.FC<GroupPillProps> = ({ group, getPropertyLabel, onRemove, onEdit, onLogicChange }) => {
  const conditionCount = group.children.length;

  return (
    <div
      onClick={onEdit}
      role="button"
      aria-label={`Edit group with ${conditionCount} conditions using ${group.logic} logic`}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onEdit();
        }
      }}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 min-h-[44px] rounded-md text-xs cursor-pointer transition-all group bg-warning-subtle border border-warning-border hover:opacity-80"
    >
      <Parentheses className="h-3 w-3 text-warning-text" />
      <div className="flex items-center gap-1">
        {group.children.slice(0, 2).map((child, idx) => {
          if (isFilterGroup(child)) {
            return (
              <span key={child.id} className="text-warning-text">
                {idx > 0 && <span className="mx-0.5">{group.logic}</span>}
                (group)
              </span>
            );
          }
          return (
            <span key={child.id} className="text-warning-text">
              {idx > 0 && <span className="mx-0.5 text-warning-text">{group.logic}</span>}
              <span className="font-medium">{getPropertyLabel(child.field)}</span>
            </span>
          );
        })}
        {conditionCount > 2 && (
          <span className="text-warning-text">+{conditionCount - 2}</span>
        )}
      </div>
      <LogicToggle logic={group.logic} onChange={onLogicChange} size="sm" />
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        aria-label="Remove group"
        className="ml-0.5 p-0.5 rounded-sm opacity-60 group-hover:opacity-100 transition-opacity text-warning-text hover:text-destructive"
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
  getPropertyLabel: (code: string) => string;
  onRemove: () => void;
  onEdit: () => void;
  onLogicChange: (logic: 'AND' | 'OR') => void;
  onParentLogicChange: (logic: 'AND' | 'OR') => void;
}

const NodeRenderer: React.FC<NodeRendererProps> = ({
  node,
  isFirst,
  parentLogic,
  getPropertyLabel,
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
          getPropertyLabel={getPropertyLabel}
          onRemove={onRemove}
          onEdit={onEdit}
          onLogicChange={onLogicChange}
        />
      ) : (
        <FilterPill
          rule={node}
          fieldLabel={getPropertyLabel(node.field)}
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
  getPropertyLabel: (code: string) => string;
  onSave: (group: FilterGroup) => void;
  onCancel: () => void;
}

const GroupEditor: React.FC<GroupEditorProps> = ({ fields, group, getPropertyLabel, onSave, onCancel }) => {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay/30">
      <div
        ref={modalRef}
        role="dialog"
        aria-labelledby="group-editor-title"
        aria-modal="true"
        className="rounded-xl w-full max-w-lg mx-4 overflow-hidden bg-card shadow-xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted">
          <div className="flex items-center gap-2">
            <Parentheses className="h-4 w-4 text-warning-text" />
            <h3 id="group-editor-title" className="text-sm font-semibold text-foreground">
              Edit Group
            </h3>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close group editor"
            className="p-1 min-h-[44px] min-w-[44px] flex items-center justify-center text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Logic Toggle */}
        <div className="px-4 py-3 bg-muted border-b border-border">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Match</span>
            <LogicToggle logic={localGroup.logic} onChange={toggleLogic} size="md" />
            <span className="text-xs text-muted-foreground">of the following conditions:</span>
          </div>
        </div>

        {/* Conditions */}
        <div className="p-4 max-h-64 overflow-y-auto">
          {localGroup.children.length === 0 ? (
            <div className="text-center py-6 text-sm text-muted-foreground">
              No conditions in this group
            </div>
          ) : (
            <div className="space-y-2">
              {localGroup.children.map((child, index) => {
                if (isFilterGroup(child)) {
                  return (
                    <div
                      key={child.id}
                      className="flex items-center gap-2 p-2 rounded-lg bg-warning-subtle"
                    >
                      <Parentheses className="h-4 w-4 text-warning-text" />
                      <span className="text-sm text-warning-text">
                        Nested group ({child.children.length} conditions)
                      </span>
                      <button
                        type="button"
                        onClick={() => removeCondition(index)}
                        aria-label="Remove nested group"
                        className="ml-auto p-1 min-h-[44px] min-w-[44px] flex items-center justify-center text-warning-text hover:text-destructive"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  );
                }

                return (
                  <div key={child.id} className="flex items-center gap-2">
                    {index > 0 && (
                      <span className="text-[10px] font-bold uppercase w-8 text-muted-foreground">
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
                        role="button"
                        aria-label={`Edit condition: ${getPropertyLabel(child.field)} ${getOperatorLabel(child.operator)}`}
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setEditingIndex(index);
                          }
                        }}
                        className="flex-1 flex items-center gap-2 p-2 min-h-[44px] rounded-lg cursor-pointer transition-colors group bg-muted hover:bg-accent"
                      >
                        <span className="font-medium text-sm text-muted-foreground">
                          {getPropertyLabel(child.field)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {getOperatorLabel(child.operator)}
                        </span>
                        {operatorNeedsValue(child.operator) && (
                          child.operator === 'between' && child.value2
                            ? <span className="text-sm text-foreground">"{child.value}" to "{child.value2}"</span>
                            : isRelativeDateOperator(child.operator)
                              ? <span className="text-sm text-foreground">{formatFilterValue(child.operator, child.value)}</span>
                              : <span className="text-sm text-foreground">"{child.value}"</span>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeCondition(index);
                          }}
                          aria-label={`Remove condition: ${getPropertyLabel(child.field)}`}
                          className="ml-auto p-1 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
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
              aria-label="Add condition to group"
              className="mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-2 min-h-[44px] text-sm font-medium rounded-lg border border-dashed transition-colors text-muted-foreground border-border hover:text-primary hover:border-primary hover:bg-primary/10"
            >
              <Plus className="h-4 w-4" />
              Add condition to group
            </button>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-border bg-muted">
          <button
            type="button"
            onClick={onCancel}
            aria-label="Cancel and close"
            className="px-4 py-2 min-h-[44px] text-sm font-medium rounded-lg border transition-colors text-muted-foreground bg-card border-border hover:bg-muted"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSave(localGroup)}
            disabled={localGroup.children.length === 0}
            aria-label="Save group"
            className={`px-4 py-2 min-h-[44px] text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              localGroup.children.length > 0
                ? 'bg-primary text-primary-foreground hover:opacity-90'
                : 'bg-muted text-muted-foreground'
            }`}
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

  const getPropertyLabel = useCallback(
    (propertyCode: string) => fields.find(f => f.code === propertyCode)?.label || propertyCode,
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
  const queryString = buildQueryString(filterGroup, getPropertyLabel);

  return (
    <div
      className="relative bg-card border-b border-border"
      role="region"
      aria-label="Query builder filters"
    >
      {/* Main bar */}
      <div className="flex items-center gap-2 px-4 py-2 flex-wrap">
        {/* Label */}
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Filter
        </span>

        {/* Filter Nodes */}
        {hasFilters && (
          <div className="flex items-center gap-1.5 flex-wrap" role="list" aria-label="Active filters">
            {filterGroup.children.map((node, index) => (
              <NodeRenderer
                key={isFilterGroup(node) ? node.id : node.id}
                node={node}
                index={index}
                parentLogic={filterGroup.logic}
                isFirst={index === 0}
                getPropertyLabel={getPropertyLabel}
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
            aria-label="Add filter condition"
            className="inline-flex items-center gap-1 px-2 py-1 min-h-[44px] text-xs font-medium rounded-md border border-dashed transition-colors text-muted-foreground border-border hover:text-primary hover:border-primary hover:bg-primary/10"
            title="Add condition"
          >
            <Plus className="h-3 w-3" />
            <span className="hidden sm:inline">Condition</span>
          </button>
          <button
            type="button"
            onClick={addGroup}
            aria-label="Add filter group"
            className="inline-flex items-center gap-1 px-2 py-1 min-h-[44px] text-xs font-medium rounded-md border border-dashed transition-colors text-warning-text border-warning-border hover:bg-warning-subtle"
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
            aria-label="Clear all filters"
            className="ml-auto text-[11px] min-h-[44px] transition-colors text-muted-foreground hover:text-destructive"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Query Preview */}
      {hasFilters && queryString && (
        <div className="px-4 py-1.5 bg-muted border-t border-border">
          <code className="text-[11px] font-mono text-muted-foreground">
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
          getPropertyLabel={getPropertyLabel}
          onSave={saveGroup}
          onCancel={() => setEditingGroup(null)}
        />
      )}
    </div>
  );
};
