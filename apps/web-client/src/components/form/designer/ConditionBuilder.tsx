import React, { useState, useMemo } from 'react';
import {
  Plus,
  Trash2,
  AlertTriangle,
  Eye,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { ModelProperty } from '../../../services/platform.service';
import {
  VisibilityCondition,
  VisibilityRule,
  ConditionOperator,
} from './types';

interface ConditionBuilderProps {
  /**
   * Available fields to build conditions against
   */
  fields: ModelProperty[];

  /**
   * Current condition configuration
   */
  condition?: VisibilityCondition;

  /**
   * Callback when condition changes
   */
  onChange: (condition: VisibilityCondition | undefined) => void;

  /**
   * Title for the condition builder
   */
  title?: string;

  /**
   * Whether the condition builder is for show/hide logic
   */
  mode?: 'visibility' | 'protection' | 'validation';
}

// Operator definitions with labels and value requirements
const OPERATORS: { value: ConditionOperator; label: string; shortLabel: string; requiresValue: boolean; valueType?: 'single' | 'multiple' }[] = [
  { value: 'equals', label: 'Equals', shortLabel: '=', requiresValue: true, valueType: 'single' },
  { value: 'not_equals', label: 'Does not equal', shortLabel: '≠', requiresValue: true, valueType: 'single' },
  { value: 'contains', label: 'Contains', shortLabel: '∋', requiresValue: true, valueType: 'single' },
  { value: 'not_contains', label: 'Does not contain', shortLabel: '∌', requiresValue: true, valueType: 'single' },
  { value: 'starts_with', label: 'Starts with', shortLabel: '^', requiresValue: true, valueType: 'single' },
  { value: 'ends_with', label: 'Ends with', shortLabel: '$', requiresValue: true, valueType: 'single' },
  { value: 'is_empty', label: 'Is empty', shortLabel: '∅', requiresValue: false },
  { value: 'is_not_empty', label: 'Is not empty', shortLabel: '≠∅', requiresValue: false },
  { value: 'greater_than', label: 'Greater than', shortLabel: '>', requiresValue: true, valueType: 'single' },
  { value: 'less_than', label: 'Less than', shortLabel: '<', requiresValue: true, valueType: 'single' },
  { value: 'greater_than_or_equals', label: 'Greater or equal', shortLabel: '≥', requiresValue: true, valueType: 'single' },
  { value: 'less_than_or_equals', label: 'Less or equal', shortLabel: '≤', requiresValue: true, valueType: 'single' },
  { value: 'in_list', label: 'Is one of', shortLabel: '∈', requiresValue: true, valueType: 'multiple' },
  { value: 'not_in_list', label: 'Is not one of', shortLabel: '∉', requiresValue: true, valueType: 'multiple' },
];

// Get operators valid for a field type
function getOperatorsForType(fieldType: string): ConditionOperator[] {
  const type = fieldType.toLowerCase();

  if (['integer', 'long', 'decimal', 'number', 'currency', 'percent'].includes(type)) {
    return ['equals', 'not_equals', 'greater_than', 'less_than', 'greater_than_or_equals', 'less_than_or_equals', 'is_empty', 'is_not_empty', 'in_list', 'not_in_list'];
  }

  if (['date', 'datetime', 'time'].includes(type)) {
    return ['equals', 'not_equals', 'greater_than', 'less_than', 'greater_than_or_equals', 'less_than_or_equals', 'is_empty', 'is_not_empty'];
  }

  if (['boolean'].includes(type)) {
    return ['equals', 'not_equals'];
  }

  if (['choice', 'multi_choice', 'tags'].includes(type)) {
    return ['equals', 'not_equals', 'contains', 'not_contains', 'is_empty', 'is_not_empty', 'in_list', 'not_in_list'];
  }

  if (['reference', 'multi_reference', 'user_reference'].includes(type)) {
    return ['equals', 'not_equals', 'is_empty', 'is_not_empty', 'in_list', 'not_in_list'];
  }

  // Default for text types
  return ['equals', 'not_equals', 'contains', 'not_contains', 'starts_with', 'ends_with', 'is_empty', 'is_not_empty', 'in_list', 'not_in_list'];
}

// Generate unique ID
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

// Single Rule Component - Vertical stacked layout for narrow panels
const RuleRow: React.FC<{
  rule: VisibilityRule;
  fields: ModelProperty[];
  onUpdate: (updates: Partial<VisibilityRule>) => void;
  onRemove: () => void;
  ruleNumber: number;
  showOperatorBadge: boolean;
  logicOperator: 'and' | 'or';
}> = ({ rule, fields, onUpdate, onRemove, ruleNumber, showOperatorBadge, logicOperator }) => {
  const selectedField = fields.find((f) => f.code === rule.field);
  const validOperators = selectedField
    ? getOperatorsForType(selectedField.type)
    : OPERATORS.map((o) => o.value);
  const selectedOperator = OPERATORS.find((o) => o.value === rule.operator);

  // Get field choices if applicable (from config.choices)
  const fieldChoices = useMemo((): { value: string; label: string }[] => {
    if (!selectedField?.config?.choices) return [];
    const choices = selectedField.config.choices;
    if (Array.isArray(choices)) {
      return choices.map((c: { value: string; label?: string }) => ({
        value: c.value,
        label: c.label || c.value,
      }));
    }
    return [];
  }, [selectedField]);

  return (
    <div className="relative">
      {/* Logic operator badge between rules */}
      {showOperatorBadge && (
        <div className="flex items-center justify-center py-1">
          <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded text-muted-foreground bg-muted">
            {logicOperator}
          </span>
        </div>
      )}

      {/* Rule card */}
      <div className="rounded-lg p-3 space-y-2 bg-card border border-border">
        {/* Header with rule number and delete */}
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-medium uppercase text-muted-foreground">
            Rule {ruleNumber}
          </span>
          <button
            onClick={onRemove}
            className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded transition-colors text-muted-foreground hover:text-destructive"
            title="Remove rule"
            aria-label={`Remove rule ${ruleNumber}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Field Selector */}
        <div>
          <label
            className="block text-[10px] font-medium mb-1 text-muted-foreground"
            htmlFor={`field-${rule.id}`}
          >
            When field
          </label>
          <select
            id={`field-${rule.id}`}
            value={rule.field}
            onChange={(e) => onUpdate({ field: e.target.value, value: undefined })}
            className="w-full h-8 px-2 text-sm rounded-md focus:outline-none transition-colors bg-card border border-border text-foreground"
            aria-label="Select field for condition"
          >
            <option value="">Select field...</option>
            {fields.map((field) => (
              <option key={field.code} value={field.code}>
                {field.label}
              </option>
            ))}
          </select>
        </div>

        {/* Operator Selector */}
        <div>
          <label
            className="block text-[10px] font-medium mb-1 text-muted-foreground"
            htmlFor={`operator-${rule.id}`}
          >
            Condition
          </label>
          <select
            id={`operator-${rule.id}`}
            value={rule.operator}
            onChange={(e) => onUpdate({ operator: e.target.value as ConditionOperator })}
            disabled={!rule.field}
            className={`w-full h-8 px-2 text-sm rounded-md focus:outline-none transition-colors disabled:opacity-50 border border-border text-foreground ${
              rule.field ? 'bg-card' : 'bg-muted'
            }`}
            aria-label="Select condition operator"
          >
            {OPERATORS.filter((o) => validOperators.includes(o.value)).map((op) => (
              <option key={op.value} value={op.value}>
                {op.label}
              </option>
            ))}
          </select>
        </div>

        {/* Value Input */}
        {selectedOperator?.requiresValue && (
          <div>
            <label
              className="block text-[10px] font-medium mb-1 text-muted-foreground"
              htmlFor={`value-${rule.id}`}
            >
              Value
            </label>
            {fieldChoices.length > 0 ? (
              selectedOperator.valueType === 'multiple' ? (
                <select
                  id={`value-${rule.id}`}
                  multiple
                  value={Array.isArray(rule.value) ? rule.value : rule.value ? [rule.value] : []}
                  onChange={(e) => {
                    const values = Array.from(e.target.selectedOptions, (opt) => opt.value);
                    onUpdate({ value: values });
                  }}
                  className="w-full h-20 px-2 text-sm rounded-md focus:outline-none transition-colors bg-card border border-border text-foreground"
                  aria-label="Select multiple values"
                >
                  {fieldChoices.map((choice) => (
                    <option key={choice.value} value={choice.value}>
                      {choice.label}
                    </option>
                  ))}
                </select>
              ) : (
                <select
                  id={`value-${rule.id}`}
                  value={rule.value || ''}
                  onChange={(e) => onUpdate({ value: e.target.value })}
                  className="w-full h-8 px-2 text-sm rounded-md focus:outline-none transition-colors bg-card border border-border text-foreground"
                  aria-label="Select value"
                >
                  <option value="">Select value...</option>
                  {fieldChoices.map((choice) => (
                    <option key={choice.value} value={choice.value}>
                      {choice.label}
                    </option>
                  ))}
                </select>
              )
            ) : selectedField?.type === 'boolean' ? (
              <select
                id={`value-${rule.id}`}
                value={rule.value?.toString() || ''}
                onChange={(e) => onUpdate({ value: e.target.value === 'true' })}
                className="w-full h-8 px-2 text-sm rounded-md focus:outline-none transition-colors bg-card border border-border text-foreground"
                aria-label="Select boolean value"
              >
                <option value="">Select...</option>
                <option value="true">True</option>
                <option value="false">False</option>
              </select>
            ) : (
              <input
                id={`value-${rule.id}`}
                type={
                  ['integer', 'long', 'decimal', 'number', 'currency', 'percent'].includes(
                    selectedField?.type?.toLowerCase() || ''
                  )
                    ? 'number'
                    : 'text'
                }
                value={rule.value || ''}
                onChange={(e) => onUpdate({ value: e.target.value })}
                placeholder="Enter value..."
                className="w-full h-8 px-2 text-sm rounded-md focus:outline-none transition-colors bg-card border border-border text-foreground"
                aria-label="Enter value"
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// Add Rule Button Component
const AddRuleButton: React.FC<{ onClick: () => void }> = ({ onClick }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center justify-center gap-1.5 text-xs font-medium rounded-md transition-colors py-[11px] min-h-[44px] text-primary bg-card border border-dashed border-border hover:bg-primary/10 hover:border-primary"
      aria-label="Add another condition"
    >
      <Plus className="h-3.5 w-3.5" />
      Add another condition
    </button>
  );
};

export const ConditionBuilder: React.FC<ConditionBuilderProps> = ({
  fields,
  condition,
  onChange,
  title = 'Visibility Condition',
  mode = 'visibility',
}) => {
  const [expanded, setExpanded] = useState(!!condition);

  // Create default condition
  const createDefaultCondition = (): VisibilityCondition => ({
    id: generateId(),
    operator: 'and',
    rules: [
      {
        id: generateId(),
        field: '',
        operator: 'equals',
        value: undefined,
      },
    ],
  });

  // Handle enable/disable condition
  const handleToggleCondition = () => {
    if (condition) {
      onChange(undefined);
      setExpanded(false);
    } else {
      onChange(createDefaultCondition());
      setExpanded(true);
    }
  };

  // Handle add rule
  const handleAddRule = () => {
    if (!condition) return;

    const newRule: VisibilityRule = {
      id: generateId(),
      field: '',
      operator: 'equals',
      value: undefined,
    };

    onChange({
      ...condition,
      rules: [...condition.rules, newRule],
    });
  };

  // Handle update rule
  const handleUpdateRule = (ruleId: string, updates: Partial<VisibilityRule>) => {
    if (!condition) return;

    onChange({
      ...condition,
      rules: condition.rules.map((rule) =>
        rule.id === ruleId ? { ...rule, ...updates } : rule
      ),
    });
  };

  // Handle remove rule
  const handleRemoveRule = (ruleId: string) => {
    if (!condition) return;

    const newRules = condition.rules.filter((rule) => rule.id !== ruleId);
    if (newRules.length === 0) {
      onChange(undefined);
      setExpanded(false);
    } else {
      onChange({
        ...condition,
        rules: newRules,
      });
    }
  };

  // Handle operator change (AND/OR)
  const handleOperatorChange = (operator: 'and' | 'or') => {
    if (!condition) return;
    onChange({ ...condition, operator });
  };

  // Get mode-specific styling and text
  const getModeConfig = () => {
    switch (mode) {
      case 'protection':
        return {
          icon: AlertTriangle,
          iconBgClass: 'bg-warning-subtle',
          iconColorClass: 'text-warning-text',
          enableText: 'Add protection rule',
          description: 'Field will be protected when conditions are met',
        };
      case 'validation':
        return {
          icon: AlertTriangle,
          iconBgClass: 'bg-destructive/20',
          iconColorClass: 'text-destructive',
          enableText: 'Add validation rule',
          description: 'Validation will be applied when conditions are met',
        };
      default:
        return {
          icon: Eye,
          iconBgClass: 'bg-primary/20',
          iconColorClass: 'text-primary',
          enableText: 'Add visibility condition',
          description: 'Element will be visible when conditions are met',
        };
    }
  };

  const modeConfig = getModeConfig();
  const Icon = modeConfig.icon;

  // Generate preview text
  const previewText = useMemo(() => {
    if (!condition || condition.rules.length === 0) return '';
    return generateConditionPreview(condition, fields);
  }, [condition, fields]);

  return (
    <div className="rounded-lg overflow-hidden bg-card border border-border">
      {/* Header - Always visible */}
      <button
        type="button"
        className="w-full flex items-center justify-between px-3 transition-colors text-left py-[11px] min-h-[44px] bg-muted hover:bg-muted/80"
        onClick={() => condition ? setExpanded(!expanded) : handleToggleCondition()}
        aria-label={condition ? (expanded ? 'Collapse condition builder' : 'Expand condition builder') : 'Add visibility condition'}
        aria-expanded={condition ? expanded : undefined}
      >
        <div className="flex items-center gap-2">
          <div className={`w-7 h-7 rounded-md flex items-center justify-center ${modeConfig.iconBgClass}`}>
            <Icon className={`h-4 w-4 ${modeConfig.iconColorClass}`} />
          </div>
          <div>
            <span className="text-sm font-medium text-foreground">
              {title}
            </span>
            {condition && (
              <span className="ml-2 text-xs text-muted-foreground">
                ({condition.rules.length} rule{condition.rules.length !== 1 ? 's' : ''})
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {condition && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange(undefined);
                setExpanded(false);
              }}
              className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded transition-colors text-muted-foreground hover:text-destructive"
              title="Remove all conditions"
              aria-label="Remove all conditions"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
          {condition ? (
            expanded ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )
          ) : (
            <Plus className="h-4 w-4 text-primary" />
          )}
        </div>
      </button>

      {/* Content - When condition exists */}
      {condition && expanded && (
        <div className="p-3 space-y-3 bg-muted">
          {/* Logic Operator Toggle - Only show if multiple rules */}
          {condition.rules.length > 1 && (
            <div
              className="flex items-center gap-2 p-2 rounded-md bg-card border border-border"
              role="group"
              aria-label="Logic operator selection"
            >
              <span className="text-xs text-muted-foreground">
                Match
              </span>
              <div
                className="flex-1 flex items-center rounded p-0.5 bg-muted"
                role="radiogroup"
              >
                <button
                  type="button"
                  onClick={() => handleOperatorChange('and')}
                  className={`flex-1 px-2 py-1 text-xs font-medium rounded transition-colors min-h-[32px] ${
                    condition.operator === 'and'
                      ? 'bg-card text-foreground shadow-sm'
                      : 'bg-transparent text-muted-foreground'
                  }`}
                  role="radio"
                  aria-checked={condition.operator === 'and'}
                  aria-label="Match all conditions"
                >
                  ALL
                </button>
                <button
                  type="button"
                  onClick={() => handleOperatorChange('or')}
                  className={`flex-1 px-2 py-1 text-xs font-medium rounded transition-colors min-h-[32px] ${
                    condition.operator === 'or'
                      ? 'bg-card text-foreground shadow-sm'
                      : 'bg-transparent text-muted-foreground'
                  }`}
                  role="radio"
                  aria-checked={condition.operator === 'or'}
                  aria-label="Match any condition"
                >
                  ANY
                </button>
              </div>
            </div>
          )}

          {/* Rules List */}
          <div className="space-y-2">
            {condition.rules.map((rule, index) => (
              <RuleRow
                key={rule.id}
                rule={rule}
                fields={fields}
                onUpdate={(updates) => handleUpdateRule(rule.id, updates)}
                onRemove={() => handleRemoveRule(rule.id)}
                ruleNumber={index + 1}
                showOperatorBadge={index > 0}
                logicOperator={condition.operator}
              />
            ))}
          </div>

          {/* Add Rule Button */}
          <AddRuleButton onClick={handleAddRule} />

          {/* Preview */}
          {previewText && (
            <div className="p-2 rounded-md bg-card border border-border">
              <p className="text-[10px] font-semibold uppercase tracking-wide mb-1 text-muted-foreground">
                Preview
              </p>
              <p className="text-xs break-words text-muted-foreground">
                {previewText}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Empty state - When no condition exists */}
      {!condition && (
        <div className="px-3 py-4 text-center">
          <p className="text-xs mb-2 text-muted-foreground">
            {modeConfig.description}
          </p>
        </div>
      )}
    </div>
  );
};

// Helper to generate human-readable condition preview
function generateConditionPreview(condition: VisibilityCondition, fields: ModelProperty[]): string {
  const parts = condition.rules.map((rule) => {
    const field = fields.find((f) => f.code === rule.field);
    const fieldLabel = field?.label || rule.field || '[field]';
    const operator = OPERATORS.find((o) => o.value === rule.operator);
    const operatorLabel = operator?.label?.toLowerCase() || rule.operator;

    if (!operator?.requiresValue) {
      return `${fieldLabel} ${operatorLabel}`;
    }

    let valueStr = '';
    if (Array.isArray(rule.value)) {
      valueStr = `(${rule.value.join(', ')})`;
    } else if (rule.value !== undefined && rule.value !== '') {
      valueStr = `"${rule.value}"`;
    } else {
      valueStr = '[value]';
    }

    return `${fieldLabel} ${operatorLabel} ${valueStr}`;
  });

  const joiner = condition.operator === 'and' ? ' AND ' : ' OR ';
  return parts.join(joiner) || 'No conditions defined';
}

export default ConditionBuilder;
