import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Save,
  ArrowLeft,
  Settings,
  ToggleLeft,
  ToggleRight,
  Trash2,
  X,
  Play,
  AlertTriangle,
} from 'lucide-react';

interface BusinessRule {
  id: string;
  code: string;
  name: string;
  description?: string;
  targetTable: string;
  ruleType: 'validation' | 'default_value' | 'calculated_field' | 'data_policy' | 'cascade';
  triggerEvents: ('insert' | 'update' | 'delete')[];
  triggerFields?: string[];
  conditionExpression?: Record<string, any>;
  actionConfig: Record<string, any>;
  executionOrder: number;
  isAsync: boolean;
  haltOnFailure: boolean;
  isActive: boolean;
  isSystem: boolean;
  source: 'platform' | 'tenant';
}

const mockRule: BusinessRule = {
  id: '1',
  code: 'wo_validate_cost',
  name: 'Validate Work Order Cost',
  description: 'Ensure estimated cost is within budget limits and requires approval if exceeding threshold',
  targetTable: 'work_order',
  ruleType: 'validation',
  triggerEvents: ['insert', 'update'],
  triggerFields: ['estimated_cost', 'actual_cost'],
  conditionExpression: {
    and: [
      { field: 'estimated_cost', operator: 'gt', value: 0 },
      { field: 'status', operator: 'ne', value: 'cancelled' },
    ],
  },
  actionConfig: {
    type: 'validate',
    expression: {
      field: 'estimated_cost',
      operator: 'lte',
      value: 50000,
    },
    errorMessage: 'Estimated cost exceeds maximum allowed value of $50,000',
    severity: 'error',
  },
  executionOrder: 10,
  isAsync: false,
  haltOnFailure: true,
  isActive: true,
  isSystem: false,
  source: 'tenant',
};

const ruleTypeLabels: Record<string, string> = {
  validation: 'Validation',
  default_value: 'Default Value',
  calculated_field: 'Calculated Field',
  data_policy: 'Data Policy',
  cascade: 'Cascade',
};

export const BusinessRuleEditorPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = id === 'new';

  const [rule, setRule] = useState<BusinessRule>(
    isNew
      ? {
          id: '',
          code: '',
          name: '',
          description: '',
          targetTable: '',
          ruleType: 'validation',
          triggerEvents: ['insert'],
          actionConfig: {},
          executionOrder: 100,
          isAsync: false,
          haltOnFailure: true,
          isActive: true,
          isSystem: false,
          source: 'tenant',
        }
      : mockRule
  );

  const [activeTab, setActiveTab] = useState<'condition' | 'action' | 'test'>('condition');
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [testData, setTestData] = useState<string>('{\n  "estimated_cost": 25000,\n  "status": "open"\n}');
  const [testResult, setTestResult] = useState<any>(null);

  const handleChange = (field: keyof BusinessRule, value: any) => {
    setRule((prev) => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleEventToggle = (event: 'insert' | 'update' | 'delete') => {
    const events = rule.triggerEvents.includes(event)
      ? rule.triggerEvents.filter((e) => e !== event)
      : [...rule.triggerEvents, event];
    handleChange('triggerEvents', events);
  };

  const handleSave = async () => {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 500));
    setSaving(false);
    setHasChanges(false);
  };

  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this business rule?')) {
      navigate('/studio/business-rules');
    }
  };

  const handleTest = () => {
    try {
      const data = JSON.parse(testData);
      // Simulate test execution
      const conditionMet = evaluateCondition(rule.conditionExpression, data);
      const actionResult = conditionMet ? simulateAction(rule.ruleType, rule.actionConfig, data) : null;

      setTestResult({
        conditionMet,
        actionResult,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      setTestResult({
        error: err.message,
        timestamp: new Date().toISOString(),
      });
    }
  };

  const evaluateCondition = (condition: any, data: Record<string, any>): boolean => {
    if (!condition) return true;

    if (condition.and) {
      return condition.and.every((c: any) => evaluateCondition(c, data));
    }
    if (condition.or) {
      return condition.or.some((c: any) => evaluateCondition(c, data));
    }

    const { field, operator, value } = condition;
    const fieldValue = data[field];

    switch (operator) {
      case 'eq': return fieldValue === value;
      case 'ne': return fieldValue !== value;
      case 'gt': return fieldValue > value;
      case 'gte': return fieldValue >= value;
      case 'lt': return fieldValue < value;
      case 'lte': return fieldValue <= value;
      default: return true;
    }
  };

  const simulateAction = (ruleType: string, config: any, data: any): any => {
    switch (ruleType) {
      case 'validation':
        const valid = evaluateCondition(config.expression, data);
        return {
          type: 'validation',
          passed: valid,
          message: valid ? 'Validation passed' : config.errorMessage,
        };
      case 'default_value':
        return {
          type: 'default_value',
          field: config.targetField,
          value: config.defaultValue,
        };
      case 'calculated_field':
        return {
          type: 'calculated_field',
          field: config.targetField,
          expression: config.expression,
          result: '(calculated)',
        };
      default:
        return { type: ruleType, config };
    }
  };

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 bg-white border-b border-slate-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/studio/business-rules')}
              className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-semibold text-slate-900">
                  {isNew ? 'New Business Rule' : rule.name}
                </h1>
                {rule.isSystem && (
                  <span className="px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-600 rounded">
                    System
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-500">
                {rule.code || 'Configure rule conditions and actions'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowSettings(true)}
              className="flex items-center gap-2 px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <Settings className="h-4 w-4" />
              Settings
            </button>

            <button
              onClick={() => handleChange('isActive', !rule.isActive)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                rule.isActive
                  ? 'text-green-600 bg-green-50 hover:bg-green-100'
                  : 'text-slate-500 bg-slate-100 hover:bg-slate-200'
              }`}
            >
              {rule.isActive ? (
                <ToggleRight className="h-4 w-4" />
              ) : (
                <ToggleLeft className="h-4 w-4" />
              )}
              {rule.isActive ? 'Active' : 'Inactive'}
            </button>

            {!isNew && !rule.isSystem && (
              <button
                onClick={handleDelete}
                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}

            <button
              onClick={handleSave}
              disabled={!hasChanges || saving || rule.isSystem}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
            >
              <Save className="h-4 w-4" />
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex-shrink-0 px-6 bg-white border-b border-slate-200">
        <div className="flex gap-6">
          {[
            { id: 'condition', label: 'When (Condition)' },
            { id: 'action', label: 'Then (Action)' },
            { id: 'test', label: 'Test' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-3 border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'condition' && (
          <div className="p-6 max-w-4xl mx-auto">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Trigger Condition</h2>
            <p className="text-sm text-slate-500 mb-6">
              Define when this rule should execute. The rule will only run when all conditions are met.
            </p>

            {/* Trigger Events */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Trigger On Events
              </label>
              <div className="flex items-center gap-4">
                {(['insert', 'update', 'delete'] as const).map((event) => (
                  <label key={event} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={rule.triggerEvents.includes(event)}
                      onChange={() => handleEventToggle(event)}
                      disabled={rule.isSystem}
                      className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm text-slate-700 capitalize">{event}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Trigger Fields */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Trigger Fields (optional)
              </label>
              <input
                type="text"
                value={rule.triggerFields?.join(', ') || ''}
                onChange={(e) => handleChange('triggerFields', e.target.value.split(',').map(f => f.trim()).filter(Boolean))}
                disabled={rule.isSystem}
                placeholder="e.g., estimated_cost, actual_cost"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-slate-50"
              />
              <p className="text-xs text-slate-500 mt-1">
                Leave empty to trigger on any field change. Comma-separated list of field names.
              </p>
            </div>

            {/* Condition Expression */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Condition Expression (JSON)
              </label>
              <textarea
                value={JSON.stringify(rule.conditionExpression || {}, null, 2)}
                onChange={(e) => {
                  try {
                    const expr = JSON.parse(e.target.value);
                    handleChange('conditionExpression', expr);
                  } catch {
                    // Invalid JSON, ignore
                  }
                }}
                disabled={rule.isSystem}
                rows={10}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-slate-50"
              />
              <p className="text-xs text-slate-500 mt-1">
                Use {"{"}"and": [], "or": []{"}"}  for compound conditions.
                Each condition: {"{"}"field": "name", "operator": "eq|ne|gt|gte|lt|lte|in|contains", "value": ...{"}"}
              </p>
            </div>
          </div>
        )}

        {activeTab === 'action' && (
          <div className="p-6 max-w-4xl mx-auto">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Action Configuration</h2>
            <p className="text-sm text-slate-500 mb-6">
              Define what happens when the condition is met.
            </p>

            {/* Rule Type Specific Config */}
            {rule.ruleType === 'validation' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Validation Expression
                  </label>
                  <textarea
                    value={JSON.stringify(rule.actionConfig.expression || {}, null, 2)}
                    onChange={(e) => {
                      try {
                        const expr = JSON.parse(e.target.value);
                        handleChange('actionConfig', { ...rule.actionConfig, expression: expr });
                      } catch {
                        // Invalid JSON
                      }
                    }}
                    disabled={rule.isSystem}
                    rows={5}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-slate-50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Error Message
                  </label>
                  <input
                    type="text"
                    value={rule.actionConfig.errorMessage || ''}
                    onChange={(e) => handleChange('actionConfig', { ...rule.actionConfig, errorMessage: e.target.value })}
                    disabled={rule.isSystem}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-slate-50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Severity
                  </label>
                  <select
                    value={rule.actionConfig.severity || 'error'}
                    onChange={(e) => handleChange('actionConfig', { ...rule.actionConfig, severity: e.target.value })}
                    disabled={rule.isSystem}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-slate-50"
                  >
                    <option value="error">Error (blocks save)</option>
                    <option value="warning">Warning (allows save)</option>
                    <option value="info">Info (informational)</option>
                  </select>
                </div>
              </div>
            )}

            {rule.ruleType === 'default_value' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Target Field
                  </label>
                  <input
                    type="text"
                    value={rule.actionConfig.targetField || ''}
                    onChange={(e) => handleChange('actionConfig', { ...rule.actionConfig, targetField: e.target.value })}
                    disabled={rule.isSystem}
                    placeholder="e.g., priority"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-slate-50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Default Value
                  </label>
                  <input
                    type="text"
                    value={rule.actionConfig.defaultValue || ''}
                    onChange={(e) => handleChange('actionConfig', { ...rule.actionConfig, defaultValue: e.target.value })}
                    disabled={rule.isSystem}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-slate-50"
                  />
                </div>
              </div>
            )}

            {rule.ruleType === 'calculated_field' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Target Field
                  </label>
                  <input
                    type="text"
                    value={rule.actionConfig.targetField || ''}
                    onChange={(e) => handleChange('actionConfig', { ...rule.actionConfig, targetField: e.target.value })}
                    disabled={rule.isSystem}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-slate-50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Expression
                  </label>
                  <textarea
                    value={rule.actionConfig.expression || ''}
                    onChange={(e) => handleChange('actionConfig', { ...rule.actionConfig, expression: e.target.value })}
                    disabled={rule.isSystem}
                    rows={4}
                    placeholder="e.g., labor_cost + material_cost + other_cost"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-slate-50"
                  />
                </div>
              </div>
            )}

            {rule.ruleType === 'cascade' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Target Table
                  </label>
                  <input
                    type="text"
                    value={rule.actionConfig.targetTable || ''}
                    onChange={(e) => handleChange('actionConfig', { ...rule.actionConfig, targetTable: e.target.value })}
                    disabled={rule.isSystem}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-slate-50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Cascade Action
                  </label>
                  <select
                    value={rule.actionConfig.cascadeAction || 'update'}
                    onChange={(e) => handleChange('actionConfig', { ...rule.actionConfig, cascadeAction: e.target.value })}
                    disabled={rule.isSystem}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-slate-50"
                  >
                    <option value="update">Update related records</option>
                    <option value="delete">Delete related records</option>
                    <option value="nullify">Set reference to null</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Field Mapping (JSON)
                  </label>
                  <textarea
                    value={JSON.stringify(rule.actionConfig.fieldMapping || {}, null, 2)}
                    onChange={(e) => {
                      try {
                        const mapping = JSON.parse(e.target.value);
                        handleChange('actionConfig', { ...rule.actionConfig, fieldMapping: mapping });
                      } catch {
                        // Invalid JSON
                      }
                    }}
                    disabled={rule.isSystem}
                    rows={4}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-slate-50"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'test' && (
          <div className="p-6 max-w-4xl mx-auto">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Test Business Rule</h2>
            <p className="text-sm text-slate-500 mb-6">
              Test your rule with sample data to verify it works as expected.
            </p>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Test Data (JSON)
                </label>
                <textarea
                  value={testData}
                  onChange={(e) => setTestData(e.target.value)}
                  rows={12}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <button
                  onClick={handleTest}
                  className="mt-3 flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                >
                  <Play className="h-4 w-4" />
                  Run Test
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Result
                </label>
                <div className="h-64 bg-slate-900 rounded-lg p-4 overflow-auto">
                  {testResult ? (
                    <pre className="text-green-400 font-mono text-sm whitespace-pre-wrap">
                      {JSON.stringify(testResult, null, 2)}
                    </pre>
                  ) : (
                    <p className="text-slate-400 text-sm">
                      Click "Run Test" to see results
                    </p>
                  )}
                </div>
              </div>
            </div>

            {testResult?.error && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0" />
                <p className="text-sm text-red-700">{testResult.error}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900">Rule Settings</h2>
              <button
                onClick={() => setShowSettings(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Rule Code
                </label>
                <input
                  type="text"
                  value={rule.code}
                  onChange={(e) => handleChange('code', e.target.value)}
                  disabled={rule.isSystem}
                  placeholder="e.g., wo_validate_cost"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-slate-50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={rule.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  disabled={rule.isSystem}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-slate-50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Description
                </label>
                <textarea
                  value={rule.description || ''}
                  onChange={(e) => handleChange('description', e.target.value)}
                  disabled={rule.isSystem}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-slate-50"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Target Table
                  </label>
                  <input
                    type="text"
                    value={rule.targetTable}
                    onChange={(e) => handleChange('targetTable', e.target.value)}
                    disabled={rule.isSystem}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-slate-50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Rule Type
                  </label>
                  <select
                    value={rule.ruleType}
                    onChange={(e) => handleChange('ruleType', e.target.value)}
                    disabled={rule.isSystem}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-slate-50"
                  >
                    {Object.entries(ruleTypeLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Execution Order
                </label>
                <input
                  type="number"
                  value={rule.executionOrder}
                  onChange={(e) => handleChange('executionOrder', parseInt(e.target.value))}
                  disabled={rule.isSystem}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-slate-50"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Lower numbers execute first (default: 100)
                </p>
              </div>

              <div className="space-y-3 pt-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={rule.isAsync}
                    onChange={(e) => handleChange('isAsync', e.target.checked)}
                    disabled={rule.isSystem}
                    className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm text-slate-700">Execute asynchronously</span>
                </label>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={rule.haltOnFailure}
                    onChange={(e) => handleChange('haltOnFailure', e.target.checked)}
                    disabled={rule.isSystem}
                    className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm text-slate-700">Halt execution on failure</span>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200">
              <button
                onClick={() => setShowSettings(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => setShowSettings(false)}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BusinessRuleEditorPage;
