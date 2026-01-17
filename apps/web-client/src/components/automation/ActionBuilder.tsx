/**
 * ActionBuilder Component
 * HubbleWave Platform - Phase 3
 *
 * Visual action builder for automation rules with:
 * - Multiple action types
 * - Drag-and-drop reordering
 * - Property value configuration
 * - Script mode for advanced users
 */

import React, { useState, useCallback } from 'react';
import { Plus, X, GripVertical, Code, Layers } from 'lucide-react';

export type ActionType = 'no_code' | 'script';

export interface AutomationActionConfig {
  id: string;
  type: string;
  config: Record<string, unknown>;
}

interface ActionBuilderProps {
  actionType: ActionType;
  actions: AutomationActionConfig[];
  script?: string;
  properties: Array<{ code: string; label: string; type: string }>;
  collectionId: string;
  onActionTypeChange: (type: ActionType) => void;
  onActionsChange: (actions: AutomationActionConfig[]) => void;
  onScriptChange: (script: string | undefined) => void;
}

interface ActionTypeOption {
  value: string;
  label: string;
  description: string;
  icon: string;
  configFields: Array<{
    key: string;
    label: string;
    type: 'property' | 'value' | 'text' | 'select' | 'formula';
    options?: Array<{ value: string; label: string }>;
    placeholder?: string;
  }>;
}

const ACTION_TYPES: ActionTypeOption[] = [
  {
    value: 'set_value',
    label: 'Set Property',
    description: 'Set a property to a specific value',
    icon: '=',
    configFields: [
      { key: 'property', label: 'Property', type: 'property' },
      { key: 'value', label: 'Value', type: 'value' },
    ],
  },
  {
    value: 'copy_value',
    label: 'Copy Value',
    description: 'Copy value from one property to another',
    icon: '->',
    configFields: [
      { key: 'sourceProperty', label: 'From Property', type: 'property' },
      { key: 'targetProperty', label: 'To Property', type: 'property' },
    ],
  },
  {
    value: 'calculate',
    label: 'Calculate',
    description: 'Set property using a formula',
    icon: 'fx',
    configFields: [
      { key: 'property', label: 'Property', type: 'property' },
      { key: 'formula', label: 'Formula', type: 'formula', placeholder: '[Quantity] * [Unit Price]' },
    ],
  },
  {
    value: 'send_notification',
    label: 'Send Notification',
    description: 'Send email or in-app notification',
    icon: 'N',
    configFields: [
      { key: 'templateCode', label: 'Template Code', type: 'text', placeholder: 'notification_template_code' },
      { key: 'recipients', label: 'Recipients', type: 'text', placeholder: 'user_id_1, user_id_2' },
      { key: 'data', label: 'Data (JSON)', type: 'text', placeholder: '{\"recordId\": \"@record.id\"}' },
    ],
  },
  {
    value: 'start_workflow',
    label: 'Start Workflow',
    description: 'Start a workflow instance',
    icon: 'W',
    configFields: [
      { key: 'workflowId', label: 'Workflow ID', type: 'text', placeholder: 'workflow_id' },
      { key: 'inputs', label: 'Inputs (JSON)', type: 'text', placeholder: '{\"recordId\": \"@record.id\"}' },
    ],
  },
  {
    value: 'create_record',
    label: 'Create Record',
    description: 'Create a new record in a collection',
    icon: '+',
    configFields: [
      { key: 'collectionId', label: 'Collection', type: 'text' },
      { key: 'values', label: 'Values (JSON)', type: 'text' },
    ],
  },
  {
    value: 'update_related',
    label: 'Update Related',
    description: 'Update related records',
    icon: 'U',
    configFields: [
      { key: 'relationship', label: 'Relationship', type: 'property' },
      { key: 'property', label: 'Property to Update', type: 'text' },
      { key: 'value', label: 'New Value', type: 'value' },
    ],
  },
  {
    value: 'abort',
    label: 'Abort Operation',
    description: 'Stop the operation and show an error',
    icon: '!',
    configFields: [
      { key: 'message', label: 'Error Message', type: 'text', placeholder: 'Cannot proceed because...' },
    ],
  },
];

function generateId(): string {
  return `act_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export const ActionBuilder: React.FC<ActionBuilderProps> = ({
  actionType,
  actions,
  script,
  properties,
  onActionTypeChange,
  onActionsChange,
  onScriptChange,
}) => {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const handleAddAction = useCallback((type: string) => {
    const newAction: AutomationActionConfig = {
      id: generateId(),
      type,
      config: {},
    };
    onActionsChange([...actions, newAction]);
  }, [actions, onActionsChange]);

  const handleRemoveAction = useCallback((index: number) => {
    onActionsChange(actions.filter((_, i) => i !== index));
  }, [actions, onActionsChange]);

  const handleUpdateAction = useCallback((index: number, field: string, value: unknown) => {
    const updated = actions.map((action, i) => {
      if (i !== index) return action;
      return { ...action, config: { ...action.config, [field]: value } };
    });
    onActionsChange(updated);
  }, [actions, onActionsChange]);

  const handleChangeActionType = useCallback((index: number, newType: string) => {
    const updated = actions.map((action, i) => {
      if (i !== index) return action;
      return { ...action, type: newType, config: {} };
    });
    onActionsChange(updated);
  }, [actions, onActionsChange]);

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const reordered = [...actions];
    const [removed] = reordered.splice(draggedIndex, 1);
    reordered.splice(index, 0, removed);
    onActionsChange(reordered);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const renderConfigField = (
    action: AutomationActionConfig,
    actionIndex: number,
    field: ActionTypeOption['configFields'][0]
  ) => {
    const value = action.config[field.key] ?? '';

    switch (field.type) {
      case 'property':
        return (
          <div key={field.key} className="flex-1">
            <label className="block text-xs font-medium mb-1 text-muted-foreground">
              {field.label}
            </label>
            <select
              value={(value as string) || ''}
              onChange={(e) => handleUpdateAction(actionIndex, field.key, e.target.value)}
              className="w-full px-3 py-1.5 text-sm rounded border border-border bg-card text-foreground focus:outline-none focus:ring-2"
            >
              <option value="">Select property...</option>
              {properties.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
        );

      case 'select':
        return (
          <div key={field.key} className="flex-1">
            <label className="block text-xs font-medium mb-1 text-muted-foreground">
              {field.label}
            </label>
            <select
              value={value as string}
              onChange={(e) => handleUpdateAction(actionIndex, field.key, e.target.value)}
              className="w-full px-3 py-1.5 text-sm rounded border border-border bg-card text-foreground focus:outline-none focus:ring-2"
            >
              <option value="">Select...</option>
              {field.options?.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        );

      case 'formula':
        return (
          <div key={field.key} className="flex-[2]">
            <label className="block text-xs font-medium mb-1 text-muted-foreground">
              {field.label}
            </label>
            <input
              type="text"
              value={value as string}
              onChange={(e) => handleUpdateAction(actionIndex, field.key, e.target.value)}
              placeholder={field.placeholder}
              className="w-full px-3 py-1.5 text-sm rounded border border-border bg-card text-foreground font-mono focus:outline-none focus:ring-2"
            />
          </div>
        );

      default:
        return (
          <div key={field.key} className="flex-1">
            <label className="block text-xs font-medium mb-1 text-muted-foreground">
              {field.label}
            </label>
            <input
              type="text"
              value={value as string}
              onChange={(e) => handleUpdateAction(actionIndex, field.key, e.target.value)}
              placeholder={field.placeholder}
              className="w-full px-3 py-1.5 text-sm rounded border border-border bg-card text-foreground focus:outline-none focus:ring-2"
            />
          </div>
        );
    }
  };

  const renderAction = (action: AutomationActionConfig, index: number) => {
    const actionDef = ACTION_TYPES.find((t) => t.value === action.type);

    return (
      <div
        key={action.id}
        draggable
        onDragStart={() => handleDragStart(index)}
        onDragOver={(e) => handleDragOver(e, index)}
        onDragEnd={handleDragEnd}
        className={`p-4 mb-3 rounded border border-border border-l-4 border-l-primary bg-card transition-shadow hover:shadow-md ${
          draggedIndex === index ? 'opacity-50' : 'opacity-100'
        }`}
      >
        {/* Action Header */}
        <div className="flex items-center gap-2 mb-4">
          <button
            type="button"
            className="p-1 cursor-grab active:cursor-grabbing rounded hover:bg-hover"
            aria-label="Drag to reorder"
          >
            <GripVertical className="w-4 h-4 text-muted-foreground" />
          </button>

          <span className="inline-flex items-center justify-center w-6 h-6 text-xs font-semibold rounded bg-primary text-primary-foreground">
            {index + 1}
          </span>

          <select
            value={action.type}
            onChange={(e) => handleChangeActionType(index, e.target.value)}
            className="flex-1 max-w-[200px] px-3 py-1.5 text-sm rounded border border-border bg-card text-foreground focus:outline-none focus:ring-2"
          >
            {ACTION_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.icon} {t.label}
              </option>
            ))}
          </select>

          <span className="flex-1 text-xs text-muted-foreground">
            {actionDef?.description}
          </span>

          <button
            type="button"
            onClick={() => handleRemoveAction(index)}
            className="p-1 rounded hover:bg-hover"
            aria-label="Remove action"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Config Fields */}
        {actionDef && (
          <div className="flex flex-wrap gap-4">
            {actionDef.configFields.map((field) => renderConfigField(action, index, field))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      {/* Action Type Toggle */}
      <div className="flex items-center gap-4 mb-4">
        <div className="inline-flex rounded border border-border">
          <button
            type="button"
            onClick={() => onActionTypeChange('no_code')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors ${
              actionType === 'no_code'
                ? 'bg-primary text-primary-foreground'
                : 'bg-transparent text-foreground hover:bg-muted'
            }`}
          >
            <Layers className="w-4 h-4" /> Visual
          </button>
          <button
            type="button"
            onClick={() => onActionTypeChange('script')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors ${
              actionType === 'script'
                ? 'bg-primary text-primary-foreground'
                : 'bg-transparent text-foreground hover:bg-muted'
            }`}
          >
            <Code className="w-4 h-4" /> Script
          </button>
        </div>
      </div>

      {/* Visual Actions */}
      {actionType === 'no_code' && (
        <>
          {actions.map((action, index) => renderAction(action, index))}

          {/* Add Action Dropdown */}
          <div className="p-4 rounded border border-dashed border-border bg-muted">
            <p className="w-full mb-2 text-sm text-muted-foreground">
              Add an action:
            </p>
            <div className="flex flex-wrap gap-2">
              {ACTION_TYPES.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => handleAddAction(type.value)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded border border-border text-foreground transition-colors hover:bg-hover"
                >
                  <Plus className="w-4 h-4" />
                  {type.label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Script Mode */}
      {actionType === 'script' && (
        <div>
          <textarea
            rows={12}
            value={script ?? ''}
            onChange={(e) => onScriptChange(e.target.value)}
            placeholder={`// Access record data via 'current' and 'previous'
// Use 'api' for platform operations
// Use 'ctx' for context (user, collection, etc.)

async function execute() {
  const { current, previous, api, ctx } = this;

  // Set a property value
  current.status = 'Approved';

  // Send notification
  await api.notify({
    to: current.assignedTo,
    subject: 'Record Updated',
    body: \`Record \${current.name} was approved.\`
  });

  // Create related record
  await api.createRecord('audit_log', {
    recordId: current.id,
    action: 'approved',
    userId: ctx.user.id
  });
}

execute();`}
            className="w-full px-3 py-2 text-sm font-mono rounded border border-border bg-card text-foreground focus:outline-none focus:ring-2"
          />
          <p className="mt-1.5 text-xs text-muted-foreground">
            Write JavaScript to execute. Available: current, previous, api, ctx
          </p>
        </div>
      )}
    </div>
  );
};
