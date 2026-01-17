/**
 * AutomationConditionBuilder Component
 * HubbleWave Platform - Phase 3
 *
 * Visual condition builder for automation rules with:
 * - AND/OR group support
 * - Property-based conditions
 * - Multiple operators
 * - Script mode for advanced users
 */

import React, { useState, useCallback } from 'react';
import { Plus, X, Code, Layers } from 'lucide-react';

export type ConditionType = 'always' | 'condition' | 'script';

export interface ConditionRule {
  id: string;
  property: string;
  operator: string;
  value: unknown;
}

export interface ConditionGroup {
  id: string;
  operator: 'and' | 'or';
  conditions: (ConditionRule | ConditionGroup)[];
}

interface AutomationConditionBuilderProps {
  conditionType: ConditionType;
  condition?: ConditionGroup | ConditionRule;
  conditionScript?: string;
  properties: Array<{ code: string; label: string; type: string }>;
  onConditionTypeChange: (type: ConditionType) => void;
  onConditionChange: (condition: ConditionGroup | ConditionRule | undefined) => void;
  onConditionScriptChange: (script: string | undefined) => void;
}

const OPERATORS: Record<string, { value: string; label: string }[]> = {
  string: [
    { value: 'equals', label: 'equals' },
    { value: 'not_equals', label: 'does not equal' },
    { value: 'contains', label: 'contains' },
    { value: 'starts_with', label: 'starts with' },
    { value: 'ends_with', label: 'ends with' },
    { value: 'is_empty', label: 'is empty' },
    { value: 'is_not_empty', label: 'is not empty' },
  ],
  number: [
    { value: 'equals', label: 'equals' },
    { value: 'not_equals', label: 'does not equal' },
    { value: 'greater_than', label: 'is greater than' },
    { value: 'less_than', label: 'is less than' },
    { value: 'greater_or_equal', label: 'is at least' },
    { value: 'less_or_equal', label: 'is at most' },
    { value: 'is_empty', label: 'is empty' },
  ],
  boolean: [
    { value: 'equals', label: 'is' },
  ],
  choice: [
    { value: 'equals', label: 'equals' },
    { value: 'not_equals', label: 'does not equal' },
    { value: 'in', label: 'is one of' },
    { value: 'not_in', label: 'is not one of' },
    { value: 'is_empty', label: 'is empty' },
  ],
  reference: [
    { value: 'equals', label: 'equals' },
    { value: 'not_equals', label: 'does not equal' },
    { value: 'is_empty', label: 'is empty' },
    { value: 'is_not_empty', label: 'is not empty' },
  ],
  default: [
    { value: 'equals', label: 'equals' },
    { value: 'not_equals', label: 'does not equal' },
    { value: 'is_empty', label: 'is empty' },
    { value: 'is_not_empty', label: 'is not empty' },
  ],
};

function generateId(): string {
  return `cond_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function createEmptyCondition(): ConditionRule {
  return { id: generateId(), property: '', operator: 'equals', value: '' };
}

function createEmptyGroup(operator: 'and' | 'or' = 'and'): ConditionGroup {
  return { id: generateId(), operator, conditions: [createEmptyCondition()] };
}

function isGroup(item: ConditionRule | ConditionGroup): item is ConditionGroup {
  return 'conditions' in item;
}

export const AutomationConditionBuilder: React.FC<AutomationConditionBuilderProps> = ({
  conditionType,
  condition,
  conditionScript,
  properties,
  onConditionTypeChange,
  onConditionChange,
  onConditionScriptChange,
}) => {
  const [showAdvanced, setShowAdvanced] = useState(conditionType === 'script');

  const handleTypeChange = (type: ConditionType) => {
    onConditionTypeChange(type);
    if (type === 'condition' && !condition) {
      onConditionChange(createEmptyGroup());
    }
  };

  const getOperatorsForProperty = useCallback(
    (propertyCode: string) => {
      const prop = properties.find((p) => p.code === propertyCode);
      if (!prop) return OPERATORS.default;

      const typeMap: Record<string, string> = {
        string: 'string',
        text: 'string',
        integer: 'number',
        decimal: 'number',
        currency: 'number',
        boolean: 'boolean',
        choice: 'choice',
        multi_choice: 'choice',
        reference: 'reference',
        multi_reference: 'reference',
      };

      const operatorKey = typeMap[prop.type] ?? 'default';
      return OPERATORS[operatorKey] ?? OPERATORS.default;
    },
    [properties]
  );

  const updateConditionAtPath = useCallback(
    (
      root: ConditionGroup | ConditionRule | undefined,
      path: string[],
      updater: (item: ConditionRule | ConditionGroup) => ConditionRule | ConditionGroup | null
    ): ConditionGroup | ConditionRule | undefined => {
      if (!root) return undefined;

      if (path.length === 0) {
        const result = updater(root);
        return result ?? undefined;
      }

      if (!isGroup(root)) return root;

      const [head, ...rest] = path;
      const index = parseInt(head, 10);

      const newConditions = root.conditions.map((cond, i) => {
        if (i !== index) return cond;
        if (rest.length === 0) {
          const result = updater(cond);
          return result ?? cond;
        }
        return updateConditionAtPath(cond, rest, updater) as ConditionRule | ConditionGroup;
      }).filter((c): c is ConditionRule | ConditionGroup => c !== null);

      return { ...root, conditions: newConditions };
    },
    []
  );

  const handleConditionChange = useCallback(
    (path: string[], field: keyof ConditionRule, value: unknown) => {
      const updated = updateConditionAtPath(condition, path, (item) => {
        if (isGroup(item)) return item;
        return { ...item, [field]: value };
      });
      onConditionChange(updated as ConditionGroup | ConditionRule | undefined);
    },
    [condition, onConditionChange, updateConditionAtPath]
  );

  const handleAddCondition = useCallback(
    (path: string[]) => {
      const updated = updateConditionAtPath(condition, path, (item) => {
        if (!isGroup(item)) return item;
        return { ...item, conditions: [...item.conditions, createEmptyCondition()] };
      });
      onConditionChange(updated as ConditionGroup | ConditionRule | undefined);
    },
    [condition, onConditionChange, updateConditionAtPath]
  );

  const handleAddGroup = useCallback(
    (path: string[]) => {
      const updated = updateConditionAtPath(condition, path, (item) => {
        if (!isGroup(item)) return item;
        return { ...item, conditions: [...item.conditions, createEmptyGroup('and')] };
      });
      onConditionChange(updated as ConditionGroup | ConditionRule | undefined);
    },
    [condition, onConditionChange, updateConditionAtPath]
  );

  const handleRemoveCondition = useCallback(
    (path: string[], index: number) => {
      const updated = updateConditionAtPath(condition, path, (item) => {
        if (!isGroup(item)) return item;
        const newConditions = item.conditions.filter((_, i) => i !== index);
        if (newConditions.length === 0) return null;
        return { ...item, conditions: newConditions };
      });
      onConditionChange(updated as ConditionGroup | ConditionRule | undefined);
    },
    [condition, onConditionChange, updateConditionAtPath]
  );

  const handleGroupOperatorChange = useCallback(
    (path: string[], operator: 'and' | 'or') => {
      const updated = updateConditionAtPath(condition, path, (item) => {
        if (!isGroup(item)) return item;
        return { ...item, operator };
      });
      onConditionChange(updated as ConditionGroup | ConditionRule | undefined);
    },
    [condition, onConditionChange, updateConditionAtPath]
  );

  const renderCondition = (
    item: ConditionRule | ConditionGroup,
    path: string[],
    groupIndex?: number
  ): React.ReactNode => {
    if (isGroup(item)) {
      return (
        <div
          key={item.id}
          className="p-4 mb-2 rounded border bg-card border-border"
        >
          <div className="flex items-center gap-4 mb-4">
            <div className="inline-flex rounded border border-border">
              <button
                type="button"
                onClick={() => handleGroupOperatorChange(path, 'and')}
                className={`px-3 py-1 text-sm font-medium transition-colors ${
                  item.operator === 'and'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-transparent text-foreground hover:bg-muted'
                }`}
              >
                AND
              </button>
              <button
                type="button"
                onClick={() => handleGroupOperatorChange(path, 'or')}
                className={`px-3 py-1 text-sm font-medium transition-colors ${
                  item.operator === 'or'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-transparent text-foreground hover:bg-muted'
                }`}
              >
                OR
              </button>
            </div>
            {groupIndex !== undefined && (
              <button
                type="button"
                onClick={() => handleRemoveCondition(path.slice(0, -1), groupIndex)}
                className="ml-auto p-1 rounded hover:bg-muted"
                aria-label="Remove group"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            )}
          </div>

          {item.conditions.map((cond, i) => (
            <React.Fragment key={isGroup(cond) ? cond.id : cond.id}>
              {i > 0 && (
                <span className="inline-block px-2 py-0.5 my-2 text-xs font-semibold rounded bg-primary/10 text-primary">
                  {item.operator.toUpperCase()}
                </span>
              )}
              {renderCondition(cond, [...path, String(i)], i)}
            </React.Fragment>
          ))}

          <div className="flex gap-2 mt-4">
            <button
              type="button"
              onClick={() => handleAddCondition(path)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded border transition-colors border-border text-foreground hover:bg-muted"
            >
              <Plus className="w-4 h-4" />
              Add Condition
            </button>
            <button
              type="button"
              onClick={() => handleAddGroup(path)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded border transition-colors border-border text-foreground hover:bg-muted"
            >
              <Plus className="w-4 h-4" />
              Add Group
            </button>
          </div>
        </div>
      );
    }

    const operators = getOperatorsForProperty(item.property);
    const needsValue = !['is_empty', 'is_not_empty'].includes(item.operator);

    return (
      <div
        key={item.id}
        className="flex items-center gap-3 p-3 mb-2 rounded bg-muted"
      >
        <select
          value={item.property || ''}
          onChange={(e) => handleConditionChange(path, 'property', e.target.value)}
          className="flex-[2] min-w-[180px] px-3 py-1.5 text-sm rounded border focus:outline-none focus:ring-2 bg-card border-border text-foreground"
        >
          <option value="">Select property...</option>
          {properties.map((p) => (
            <option key={p.code} value={p.code}>
              {p.label}
            </option>
          ))}
        </select>

        <select
          value={item.operator}
          onChange={(e) => handleConditionChange(path, 'operator', e.target.value)}
          className="flex-[1.5] min-w-[140px] px-3 py-1.5 text-sm rounded border focus:outline-none focus:ring-2 bg-card border-border text-foreground"
        >
          {operators.map((op) => (
            <option key={op.value} value={op.value}>
              {op.label}
            </option>
          ))}
        </select>

        {needsValue && (
          <input
            type="text"
            placeholder="Value"
            value={(item.value as string) ?? ''}
            onChange={(e) => handleConditionChange(path, 'value', e.target.value)}
            className="flex-[2] min-w-[160px] px-3 py-1.5 text-sm rounded border focus:outline-none focus:ring-2 bg-card border-border text-foreground"
          />
        )}

        {groupIndex !== undefined && (
          <button
            type="button"
            onClick={() => handleRemoveCondition(path.slice(0, -1), groupIndex)}
            className="p-1 rounded hover:bg-muted/80"
            aria-label="Remove condition"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        )}
      </div>
    );
  };

  return (
    <div>
      {/* Condition Type Selector */}
      <div className="flex items-center gap-4 mb-4">
        <div className="min-w-[160px]">
          <label className="block text-xs font-medium mb-1 text-muted-foreground">
            When to run
          </label>
          <select
            value={conditionType}
            onChange={(e) => handleTypeChange(e.target.value as ConditionType)}
            className="w-full px-3 py-1.5 text-sm rounded border focus:outline-none focus:ring-2 bg-card border-border text-foreground"
          >
            <option value="always">Always</option>
            <option value="condition">When conditions match</option>
            <option value="script">Custom script</option>
          </select>
        </div>

        {conditionType === 'condition' && (
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded border transition-colors self-end border-border text-foreground hover:bg-muted"
          >
            {showAdvanced ? <Layers className="w-4 h-4" /> : <Code className="w-4 h-4" />}
            {showAdvanced ? 'Visual Mode' : 'JSON Mode'}
          </button>
        )}
      </div>

      {/* Condition Builder */}
      {conditionType === 'condition' && (
        showAdvanced ? (
          <div>
            <textarea
              rows={6}
              value={JSON.stringify(condition ?? {}, null, 2)}
              onChange={(e) => {
                try {
                  onConditionChange(JSON.parse(e.target.value));
                } catch {
                  // Invalid JSON, keep editing
                }
              }}
              placeholder="Enter condition JSON..."
              className="w-full px-3 py-2 text-sm font-mono rounded border focus:outline-none focus:ring-2 bg-card border-border text-foreground"
            />
          </div>
        ) : condition && isGroup(condition) ? (
          renderCondition(condition, [])
        ) : (
          <div>
            <button
              type="button"
              onClick={() => onConditionChange(createEmptyGroup())}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded border transition-colors border-border text-foreground hover:bg-muted"
            >
              <Plus className="w-4 h-4" />
              Add Condition
            </button>
          </div>
        )
      )}

      {/* Script Editor */}
      {conditionType === 'script' && (
        <div>
          <textarea
            rows={8}
            value={conditionScript ?? ''}
            onChange={(e) => onConditionScriptChange(e.target.value)}
            placeholder={`// Return true to execute actions
// Available: current, previous, context
return current.status === 'Active';`}
            className="w-full px-3 py-2 text-sm font-mono rounded border focus:outline-none focus:ring-2 bg-card border-border text-foreground"
          />
          <p className="mt-1.5 text-xs text-muted-foreground">
            Write JavaScript that returns true/false. Available variables: current, previous, context
          </p>
        </div>
      )}
    </div>
  );
};
