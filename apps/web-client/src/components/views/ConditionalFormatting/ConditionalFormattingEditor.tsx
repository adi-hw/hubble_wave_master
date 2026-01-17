/**
 * ConditionalFormattingEditor Component
 * HubbleWave Platform - Phase 2
 *
 * Visual editor for creating and managing conditional formatting rules.
 * Supports row-level, cell-level, and column-level formatting.
 */

import React, { useState, useCallback } from 'react';
import {
  Plus,
  Trash2,
  GripVertical,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  Copy,
  Settings,
  Palette,
  Type,
  Bold,
  Italic,
  Strikethrough,
  AlertCircle,
  Info,
  Tag,
  X,
} from 'lucide-react';
import {
  DndContext,
  DragEndEvent,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  ConditionalFormatRule,
  ConditionalFormatCondition,
  ConditionalOperator,
  FormatStyle,
  FormatStyleType,
  ConditionalFormattingConfig,
} from '../types';

interface Property {
  code: string;
  name: string;
  type: string;
}

interface ConditionalFormattingEditorProps {
  config: ConditionalFormattingConfig;
  properties: Property[];
  onChange: (config: ConditionalFormattingConfig) => void;
  onClose?: () => void;
}

// Operator options by property type
const OPERATORS: Record<string, { value: ConditionalOperator; label: string }[]> = {
  default: [
    { value: 'equals', label: 'equals' },
    { value: 'not_equals', label: 'does not equal' },
    { value: 'is_empty', label: 'is empty' },
    { value: 'is_not_empty', label: 'is not empty' },
  ],
  text: [
    { value: 'equals', label: 'equals' },
    { value: 'not_equals', label: 'does not equal' },
    { value: 'contains', label: 'contains' },
    { value: 'not_contains', label: 'does not contain' },
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
    { value: 'greater_than_or_equal', label: 'is greater than or equal' },
    { value: 'less_than_or_equal', label: 'is less than or equal' },
    { value: 'between', label: 'is between' },
    { value: 'is_empty', label: 'is empty' },
    { value: 'is_not_empty', label: 'is not empty' },
  ],
  date: [
    { value: 'equals', label: 'equals' },
    { value: 'not_equals', label: 'does not equal' },
    { value: 'is_today', label: 'is today' },
    { value: 'is_past', label: 'is in the past' },
    { value: 'is_future', label: 'is in the future' },
    { value: 'is_this_week', label: 'is this week' },
    { value: 'is_this_month', label: 'is this month' },
    { value: 'greater_than', label: 'is after' },
    { value: 'less_than', label: 'is before' },
    { value: 'is_empty', label: 'is empty' },
    { value: 'is_not_empty', label: 'is not empty' },
  ],
  boolean: [
    { value: 'equals', label: 'is' },
    { value: 'not_equals', label: 'is not' },
  ],
};

// Preset colors for easy selection
const PRESET_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#14b8a6', // teal
  '#3b82f6', // blue
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#6b7280', // gray
];

// Style type options
const STYLE_TYPES: { value: FormatStyleType; label: string; icon: React.ReactNode }[] = [
  { value: 'background', label: 'Background Color', icon: <Palette size={16} /> },
  { value: 'text_color', label: 'Text Color', icon: <Type size={16} /> },
  { value: 'bold', label: 'Bold', icon: <Bold size={16} /> },
  { value: 'italic', label: 'Italic', icon: <Italic size={16} /> },
  { value: 'strikethrough', label: 'Strikethrough', icon: <Strikethrough size={16} /> },
  { value: 'badge', label: 'Badge', icon: <Tag size={16} /> },
  { value: 'icon', label: 'Icon', icon: <AlertCircle size={16} /> },
  { value: 'border', label: 'Border', icon: <Settings size={16} /> },
];

// Style preview component that requires dynamic styles for user-selected colors
const StylePreview: React.FC<{ style: FormatStyle }> = ({ style }) => {
  const baseClasses = 'w-5 h-5 rounded flex items-center justify-center text-xs';
  const dynamicStyle: React.CSSProperties = {
    backgroundColor: style.backgroundColor || 'transparent',
    color: style.textColor || undefined,
    fontWeight: style.type === 'bold' ? 'bold' : undefined,
    fontStyle: style.type === 'italic' ? 'italic' : undefined,
    textDecoration: style.type === 'strikethrough' ? 'line-through' : undefined,
    border: style.borderColor ? `2px solid ${style.borderColor}` : undefined,
  };

  return (
    <div
      className={`${baseClasses} ${!style.textColor ? 'text-foreground' : ''}`}
      style={dynamicStyle}
      title={style.type}
    >
      {style.type === 'badge' && 'B'}
      {style.type === 'icon' && '!'}
    </div>
  );
};

// Color picker button component - requires dynamic background for user colors
const ColorPickerButton: React.FC<{
  color: string;
  isSelected: boolean;
  onClick: () => void;
}> = ({ color, isSelected, onClick }) => (
  <button
    onClick={onClick}
    className="w-5 h-5 rounded-full border-2 transition-transform hover:scale-110"
    style={{
      backgroundColor: color,
      borderColor: isSelected ? 'white' : 'transparent',
    }}
    aria-label={`Select ${color}`}
  />
);

// Sortable rule item
const SortableRuleItem: React.FC<{
  rule: ConditionalFormatRule;
  properties: Property[];
  isExpanded: boolean;
  onToggleExpand: () => void;
  onUpdate: (updates: Partial<ConditionalFormatRule>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
}> = ({ rule, properties, isExpanded, onToggleExpand, onUpdate, onDelete, onDuplicate }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: rule.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const getPropertyType = (code: string): string => {
    const prop = properties.find(p => p.code === code);
    if (!prop) return 'text';
    const type = prop.type.toLowerCase();
    if (['integer', 'decimal', 'number', 'currency', 'percent'].includes(type)) return 'number';
    if (['date', 'datetime', 'time'].includes(type)) return 'date';
    if (type === 'boolean') return 'boolean';
    return 'text';
  };

  const addCondition = () => {
    const newCondition: ConditionalFormatCondition = {
      id: `condition-${Date.now()}`,
      property: properties[0]?.code || '',
      operator: 'equals',
    };
    onUpdate({
      conditions: [...rule.conditions, newCondition],
    });
  };

  const updateCondition = (conditionId: string, updates: Partial<ConditionalFormatCondition>) => {
    onUpdate({
      conditions: rule.conditions.map(c =>
        c.id === conditionId ? { ...c, ...updates } : c
      ),
    });
  };

  const removeCondition = (conditionId: string) => {
    onUpdate({
      conditions: rule.conditions.filter(c => c.id !== conditionId),
    });
  };

  const addStyle = (type: FormatStyleType) => {
    const newStyle: FormatStyle = {
      type,
      ...(type === 'background' && { backgroundColor: '#22c55e' }),
      ...(type === 'text_color' && { textColor: '#ef4444' }),
      ...(type === 'badge' && { badgeText: 'Label', badgeColor: '#3b82f6' }),
      ...(type === 'border' && { borderColor: '#ef4444', borderWidth: 2 }),
    };
    onUpdate({
      styles: [...rule.styles, newStyle],
    });
  };

  const updateStyle = (index: number, updates: Partial<FormatStyle>) => {
    onUpdate({
      styles: rule.styles.map((s, i) =>
        i === index ? { ...s, ...updates } : s
      ),
    });
  };

  const removeStyle = (index: number) => {
    onUpdate({
      styles: rule.styles.filter((_, i) => i !== index),
    });
  };

  // Get operators for current property in condition
  const getOperatorsForCondition = (condition: ConditionalFormatCondition) => {
    const propType = getPropertyType(condition.property);
    return OPERATORS[propType] || OPERATORS.default;
  };

  // Check if operator needs value input
  const operatorNeedsValue = (operator: ConditionalOperator): boolean => {
    return !['is_empty', 'is_not_empty', 'is_today', 'is_past', 'is_future', 'is_this_week', 'is_this_month'].includes(operator);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="rounded-lg mb-3 overflow-hidden"
      {...attributes}
    >
      <div
        className={`flex items-center gap-3 p-3 bg-muted ${isExpanded ? 'border-b border-border' : ''}`}
      >
        {/* Drag Handle */}
        <div
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-1 text-muted-foreground/60"
        >
          <GripVertical size={16} />
        </div>

        {/* Expand Toggle */}
        <button
          onClick={onToggleExpand}
          className="p-1 text-muted-foreground"
          aria-expanded={isExpanded}
          aria-label={isExpanded ? 'Collapse rule' : 'Expand rule'}
        >
          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>

        {/* Enable Toggle */}
        <button
          onClick={() => onUpdate({ enabled: !rule.enabled })}
          className={`p-1 ${rule.enabled ? 'text-success-text' : 'text-muted-foreground/60'}`}
          title={rule.enabled ? 'Disable rule' : 'Enable rule'}
          aria-label={rule.enabled ? 'Disable rule' : 'Enable rule'}
        >
          {rule.enabled ? <Eye size={16} /> : <EyeOff size={16} />}
        </button>

        {/* Rule Name */}
        <input
          type="text"
          value={rule.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          className="flex-1 px-2 py-1 text-sm font-medium rounded bg-transparent border border-transparent text-foreground focus:border-border focus:bg-card"
          placeholder="Rule name"
        />

        {/* Style Preview */}
        <div className="flex items-center gap-1">
          {rule.styles.map((styleItem, i) => (
            <StylePreview key={i} style={styleItem} />
          ))}
        </div>

        {/* Actions */}
        <button
          onClick={onDuplicate}
          className="p-1.5 rounded text-muted-foreground hover:bg-muted"
          title="Duplicate rule"
          aria-label="Duplicate rule"
        >
          <Copy size={14} />
        </button>
        <button
          onClick={onDelete}
          className="p-1.5 rounded text-destructive hover:bg-muted"
          title="Delete rule"
          aria-label="Delete rule"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="p-4 space-y-4 bg-card">
          {/* Scope Selection */}
          <div>
            <label className="block text-xs font-medium mb-2 text-muted-foreground">
              Apply to
            </label>
            <div className="flex gap-2">
              {(['row', 'cell', 'column'] as const).map((scope) => (
                <button
                  key={scope}
                  onClick={() => onUpdate({ scope })}
                  className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                    rule.scope === scope
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-foreground'
                  }`}
                >
                  {scope === 'row' && 'Entire Row'}
                  {scope === 'cell' && 'Specific Cell'}
                  {scope === 'column' && 'Entire Column'}
                </button>
              ))}
            </div>
          </div>

          {/* Target Property (for cell/column scope) */}
          {(rule.scope === 'cell' || rule.scope === 'column') && (
            <div>
              <label className="block text-xs font-medium mb-2 text-muted-foreground">
                Target Property
              </label>
              <select
                value={rule.targetProperty || ''}
                onChange={(e) => onUpdate({ targetProperty: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg bg-muted border border-border text-foreground"
              >
                <option value="">Select property...</option>
                {properties.map((prop) => (
                  <option key={prop.code} value={prop.code}>
                    {prop.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Conditions */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-muted-foreground">
                When
              </label>
              {rule.conditions.length > 1 && (
                <select
                  value={rule.conditionLogic}
                  onChange={(e) =>
                    onUpdate({ conditionLogic: e.target.value as 'and' | 'or' })
                  }
                  className="text-xs px-2 py-1 rounded bg-muted border border-border text-foreground"
                >
                  <option value="and">All conditions match (AND)</option>
                  <option value="or">Any condition matches (OR)</option>
                </select>
              )}
            </div>

            <div className="space-y-2">
              {rule.conditions.map((condition, index) => (
                <div
                  key={condition.id}
                  className="flex items-center gap-2 p-2 rounded-lg bg-muted"
                >
                  {index > 0 && (
                    <span className="text-xs font-medium px-2 text-muted-foreground/60">
                      {rule.conditionLogic.toUpperCase()}
                    </span>
                  )}

                  <select
                    value={condition.property}
                    onChange={(e) =>
                      updateCondition(condition.id, { property: e.target.value })
                    }
                    className="flex-1 px-2 py-1.5 text-sm rounded bg-card border border-border text-foreground"
                  >
                    {properties.map((prop) => (
                      <option key={prop.code} value={prop.code}>
                        {prop.name}
                      </option>
                    ))}
                  </select>

                  <select
                    value={condition.operator}
                    onChange={(e) =>
                      updateCondition(condition.id, {
                        operator: e.target.value as ConditionalOperator,
                      })
                    }
                    className="flex-1 px-2 py-1.5 text-sm rounded bg-card border border-border text-foreground"
                  >
                    {getOperatorsForCondition(condition).map((op) => (
                      <option key={op.value} value={op.value}>
                        {op.label}
                      </option>
                    ))}
                  </select>

                  {operatorNeedsValue(condition.operator) && (
                    <input
                      type="text"
                      value={String(condition.value ?? '')}
                      onChange={(e) =>
                        updateCondition(condition.id, { value: e.target.value })
                      }
                      placeholder="Value"
                      className="flex-1 px-2 py-1.5 text-sm rounded bg-card border border-border text-foreground"
                    />
                  )}

                  {condition.operator === 'between' && (
                    <input
                      type="text"
                      value={String(condition.value2 ?? '')}
                      onChange={(e) =>
                        updateCondition(condition.id, { value2: e.target.value })
                      }
                      placeholder="and"
                      className="flex-1 px-2 py-1.5 text-sm rounded bg-card border border-border text-foreground"
                    />
                  )}

                  <button
                    onClick={() => removeCondition(condition.id)}
                    className="p-1.5 rounded text-destructive hover:bg-muted"
                    aria-label="Remove condition"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>

            <button
              onClick={addCondition}
              className="mt-2 flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg bg-muted text-primary"
            >
              <Plus size={14} />
              Add Condition
            </button>
          </div>

          {/* Styles */}
          <div>
            <label className="block text-xs font-medium mb-2 text-muted-foreground">
              Then apply
            </label>

            <div className="space-y-2">
              {rule.styles.map((styleItem, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 p-2 rounded-lg bg-muted"
                >
                  <span className="text-sm text-foreground">
                    {STYLE_TYPES.find((s) => s.value === styleItem.type)?.label}
                  </span>

                  {(styleItem.type === 'background' || styleItem.type === 'text_color' || styleItem.type === 'border') && (
                    <div className="flex items-center gap-1">
                      {PRESET_COLORS.map((color) => (
                        <ColorPickerButton
                          key={color}
                          color={color}
                          isSelected={
                            styleItem.backgroundColor === color ||
                            styleItem.textColor === color ||
                            styleItem.borderColor === color
                          }
                          onClick={() =>
                            updateStyle(index, {
                              [styleItem.type === 'background'
                                ? 'backgroundColor'
                                : styleItem.type === 'text_color'
                                ? 'textColor'
                                : 'borderColor']: color,
                            })
                          }
                        />
                      ))}
                    </div>
                  )}

                  {styleItem.type === 'badge' && (
                    <input
                      type="text"
                      value={styleItem.badgeText || ''}
                      onChange={(e) =>
                        updateStyle(index, { badgeText: e.target.value })
                      }
                      placeholder="Badge text"
                      className="flex-1 px-2 py-1 text-sm rounded bg-card border border-border text-foreground"
                    />
                  )}

                  <button
                    onClick={() => removeStyle(index)}
                    className="p-1.5 rounded text-destructive hover:bg-muted"
                    aria-label="Remove style"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>

            {/* Add Style Buttons */}
            <div className="mt-2 flex flex-wrap gap-2">
              {STYLE_TYPES.filter(
                (st) => !rule.styles.some((s) => s.type === st.value)
              ).map((styleType) => (
                <button
                  key={styleType.value}
                  onClick={() => addStyle(styleType.value)}
                  className="flex items-center gap-1 px-2 py-1 text-xs rounded-lg bg-muted text-muted-foreground hover:text-foreground"
                >
                  {styleType.icon}
                  {styleType.label}
                </button>
              ))}
            </div>
          </div>

          {/* Stop if True Option */}
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={rule.stopIfTrue ?? false}
              onChange={(e) => onUpdate({ stopIfTrue: e.target.checked })}
              className="w-4 h-4 rounded"
            />
            <span className="text-sm text-foreground">
              Stop evaluating rules if this rule matches
            </span>
          </label>
        </div>
      )}
    </div>
  );
};

export const ConditionalFormattingEditor: React.FC<ConditionalFormattingEditorProps> = ({
  config,
  properties,
  onChange,
  onClose,
}) => {
  const [expandedRules, setExpandedRules] = useState<Set<string>>(new Set());

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
  );

  const toggleRuleExpanded = useCallback((ruleId: string) => {
    setExpandedRules((prev) => {
      const next = new Set(prev);
      if (next.has(ruleId)) {
        next.delete(ruleId);
      } else {
        next.add(ruleId);
      }
      return next;
    });
  }, []);

  const addRule = useCallback(() => {
    const newRule: ConditionalFormatRule = {
      id: `rule-${Date.now()}`,
      name: `Rule ${config.rules.length + 1}`,
      enabled: true,
      priority: config.rules.length + 1,
      scope: 'row',
      conditions: [
        {
          id: `condition-${Date.now()}`,
          property: properties[0]?.code || '',
          operator: 'equals',
        },
      ],
      conditionLogic: 'and',
      styles: [
        {
          type: 'background',
          backgroundColor: '#22c55e',
        },
      ],
    };

    onChange({
      ...config,
      rules: [...config.rules, newRule],
    });

    setExpandedRules((prev) => new Set(prev).add(newRule.id));
  }, [config, properties, onChange]);

  const updateRule = useCallback(
    (ruleId: string, updates: Partial<ConditionalFormatRule>) => {
      onChange({
        ...config,
        rules: config.rules.map((r) =>
          r.id === ruleId ? { ...r, ...updates } : r
        ),
      });
    },
    [config, onChange]
  );

  const deleteRule = useCallback(
    (ruleId: string) => {
      onChange({
        ...config,
        rules: config.rules.filter((r) => r.id !== ruleId),
      });
    },
    [config, onChange]
  );

  const duplicateRule = useCallback(
    (ruleId: string) => {
      const original = config.rules.find((r) => r.id === ruleId);
      if (!original) return;

      const newRule: ConditionalFormatRule = {
        ...JSON.parse(JSON.stringify(original)),
        id: `rule-${Date.now()}`,
        name: `${original.name} (copy)`,
        priority: config.rules.length + 1,
      };

      onChange({
        ...config,
        rules: [...config.rules, newRule],
      });

      setExpandedRules((prev) => new Set(prev).add(newRule.id));
    },
    [config, onChange]
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = config.rules.findIndex((r) => r.id === active.id);
      const newIndex = config.rules.findIndex((r) => r.id === over.id);

      const newRules = [...config.rules];
      const [removed] = newRules.splice(oldIndex, 1);
      newRules.splice(newIndex, 0, removed);

      // Update priorities
      const updatedRules = newRules.map((r, i) => ({
        ...r,
        priority: i + 1,
      }));

      onChange({
        ...config,
        rules: updatedRules,
      });
    },
    [config, onChange]
  );

  return (
    <div className="flex flex-col h-full max-h-[80vh] rounded-xl overflow-hidden bg-card border border-border">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 flex-shrink-0 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary/10">
            <Palette size={20} className="text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              Conditional Formatting
            </h2>
            <p className="text-sm text-muted-foreground">
              {config.rules.length} rule{config.rules.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 px-3 py-1.5 rounded-lg">
            <input
              type="checkbox"
              checked={config.enabled}
              onChange={(e) => onChange({ ...config, enabled: e.target.checked })}
              className="w-4 h-4 rounded"
            />
            <span className="text-sm text-foreground">
              Enabled
            </span>
          </label>

          {onClose && (
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-muted-foreground hover:bg-muted"
              aria-label="Close"
            >
              <X size={20} />
            </button>
          )}
        </div>
      </div>

      {/* Rules List */}
      <div className="flex-1 overflow-y-auto p-4">
        {config.rules.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Palette
              size={48}
              className="text-muted-foreground/60"
            />
            <p className="mt-4 text-center text-muted-foreground">
              No formatting rules yet
            </p>
            <button
              onClick={addRule}
              className="mt-4 flex items-center gap-2 px-4 py-2 rounded-lg font-medium bg-primary text-primary-foreground"
            >
              <Plus size={16} />
              Create your first rule
            </button>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={config.rules.map((r) => r.id)}
              strategy={verticalListSortingStrategy}
            >
              {config.rules.map((rule) => (
                <SortableRuleItem
                  key={rule.id}
                  rule={rule}
                  properties={properties}
                  isExpanded={expandedRules.has(rule.id)}
                  onToggleExpand={() => toggleRuleExpanded(rule.id)}
                  onUpdate={(updates) => updateRule(rule.id, updates)}
                  onDelete={() => deleteRule(rule.id)}
                  onDuplicate={() => duplicateRule(rule.id)}
                />
              ))}
            </SortableContext>
          </DndContext>
        )}
      </div>

      {/* Footer */}
      {config.rules.length > 0 && (
        <div className="flex items-center justify-between px-4 py-3 flex-shrink-0 border-t border-border bg-muted">
          <button
            onClick={addRule}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium bg-primary text-primary-foreground"
          >
            <Plus size={16} />
            Add Rule
          </button>

          <div className="flex items-center gap-2 text-xs text-muted-foreground/60">
            <Info size={14} />
            <span>Drag to reorder. Higher rules take priority.</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConditionalFormattingEditor;
