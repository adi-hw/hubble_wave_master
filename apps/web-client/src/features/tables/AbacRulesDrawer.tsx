import React, { useEffect, useState } from 'react';
import {
  X,
  Plus,
  Trash2,
  Filter,
  AlertCircle,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';

interface AbacRule {
  id: string;
  name: string;
  condition: string;
  effect: 'ALLOW' | 'DENY';
  priority: number;
}

interface Props {
  open: boolean;
  tableCode: string;
  operation: 'create' | 'read' | 'update' | 'delete';
  operationLabel: string;
  operationColor: string;
  onClose: () => void;
  onSave: (rules: AbacRule[]) => void;
  initialRules?: AbacRule[];
}

const generateId = () => Math.random().toString(36).substring(2, 9);

export const AbacRulesDrawer: React.FC<Props> = ({
  open,
  tableCode,
  operation,
  operationLabel,
  operationColor,
  onClose,
  onSave,
  initialRules = [],
}) => {
  const [rules, setRules] = useState<AbacRule[]>(initialRules);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setRules(initialRules.length > 0 ? initialRules : []);
    }
  }, [open, initialRules]);

  if (!open) return null;

  const addRule = () => {
    const newRule: AbacRule = {
      id: generateId(),
      name: `Rule ${rules.length + 1}`,
      condition: '',
      effect: 'ALLOW',
      priority: rules.length + 1,
    };
    setRules([...rules, newRule]);
  };

  const updateRule = (id: string, updates: Partial<AbacRule>) => {
    setRules(rules.map(r => r.id === id ? { ...r, ...updates } : r));
  };

  const removeRule = (id: string) => {
    setRules(rules.filter(r => r.id !== id));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(rules);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className="relative flex h-full w-full max-w-xl flex-col shadow-2xl"
        style={{ backgroundColor: 'var(--hw-bg)' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b"
          style={{ borderColor: 'var(--hw-border-subtle)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="p-2 rounded-xl"
              style={{ backgroundColor: `${operationColor}15` }}
            >
              <Filter className="h-5 w-5" style={{ color: operationColor }} />
            </div>
            <div>
              <h2 className="text-lg font-semibold" style={{ color: 'var(--hw-text)' }}>
                Conditional Rules
              </h2>
              <p className="text-xs" style={{ color: 'var(--hw-text-muted)' }}>
                {tableCode} • {operationLabel} operation
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
            style={{ color: 'var(--hw-text-muted)' }}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto px-6 py-6 space-y-6">
          {/* Info Card */}
          <Card variant="default" padding="md" className="border-blue-200 bg-blue-50/50">
            <div className="flex gap-3">
              <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">About ABAC Rules</p>
                <p className="text-xs text-blue-700">
                  Attribute-Based Access Control rules allow fine-grained access control based on
                  record attributes, user context, and other conditions. Rules are evaluated in priority order.
                </p>
              </div>
            </div>
          </Card>

          {/* Rules List */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold" style={{ color: 'var(--hw-text)' }}>
                Rules ({rules.length})
              </h3>
              <Button
                variant="secondary"
                size="sm"
                onClick={addRule}
                leftIcon={<Plus className="h-4 w-4" />}
              >
                Add Rule
              </Button>
            </div>

            {rules.length === 0 ? (
              <Card variant="default" padding="lg" className="text-center">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3"
                  style={{ backgroundColor: 'var(--hw-bg-subtle)' }}
                >
                  <Filter className="h-6 w-6" style={{ color: 'var(--hw-text-muted)' }} />
                </div>
                <p className="text-sm font-medium mb-1" style={{ color: 'var(--hw-text)' }}>
                  No conditional rules
                </p>
                <p className="text-xs mb-4" style={{ color: 'var(--hw-text-muted)' }}>
                  All users with the required roles can {operation} records
                </p>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={addRule}
                  leftIcon={<Plus className="h-4 w-4" />}
                >
                  Create First Rule
                </Button>
              </Card>
            ) : (
              <div className="space-y-3">
                {rules.map((rule, index) => (
                  <Card key={rule.id} variant="default" padding="none" className="overflow-hidden">
                    <div
                      className="px-4 py-2 flex items-center justify-between"
                      style={{ backgroundColor: 'var(--hw-bg-subtle)' }}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="text-xs font-medium px-2 py-0.5 rounded"
                          style={{ backgroundColor: 'var(--hw-bg)', color: 'var(--hw-text-muted)' }}
                        >
                          #{index + 1}
                        </span>
                        <Badge
                          variant={rule.effect === 'ALLOW' ? 'success' : 'danger'}
                          size="sm"
                        >
                          {rule.effect}
                        </Badge>
                      </div>
                      <button
                        onClick={() => removeRule(rule.id)}
                        className="p-1 rounded hover:bg-red-100 transition-colors"
                        style={{ color: '#ef4444' }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="p-4 space-y-4">
                      <Input
                        label="Rule Name"
                        placeholder="e.g., Allow own records only"
                        value={rule.name}
                        onChange={(e) => updateRule(rule.id, { name: e.target.value })}
                      />

                      <div>
                        <label
                          className="block text-sm font-medium mb-1.5"
                          style={{ color: 'var(--hw-text-secondary)' }}
                        >
                          Condition Expression
                        </label>
                        <textarea
                          placeholder="e.g., record.created_by == user.id"
                          value={rule.condition}
                          onChange={(e) => updateRule(rule.id, { condition: e.target.value })}
                          rows={2}
                          className="w-full px-3 py-2 rounded-lg border text-sm font-mono resize-none"
                          style={{
                            backgroundColor: 'var(--hw-bg)',
                            borderColor: 'var(--hw-border)',
                            color: 'var(--hw-text)',
                          }}
                        />
                        <p className="text-xs mt-1" style={{ color: 'var(--hw-text-muted)' }}>
                          Use JavaScript-like expressions. Available: record.*, user.*, context.*
                        </p>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="flex-1">
                          <label
                            className="block text-sm font-medium mb-1.5"
                            style={{ color: 'var(--hw-text-secondary)' }}
                          >
                            Effect
                          </label>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => updateRule(rule.id, { effect: 'ALLOW' })}
                              className={`flex-1 px-3 py-2 rounded-lg border-2 text-sm font-medium transition-all ${
                                rule.effect === 'ALLOW' ? 'border-green-500 bg-green-50' : 'border-slate-200'
                              }`}
                              style={{ color: rule.effect === 'ALLOW' ? '#22c55e' : 'var(--hw-text-muted)' }}
                            >
                              Allow
                            </button>
                            <button
                              type="button"
                              onClick={() => updateRule(rule.id, { effect: 'DENY' })}
                              className={`flex-1 px-3 py-2 rounded-lg border-2 text-sm font-medium transition-all ${
                                rule.effect === 'DENY' ? 'border-red-500 bg-red-50' : 'border-slate-200'
                              }`}
                              style={{ color: rule.effect === 'DENY' ? '#ef4444' : 'var(--hw-text-muted)' }}
                            >
                              Deny
                            </button>
                          </div>
                        </div>

                        <div className="w-24">
                          <label
                            className="block text-sm font-medium mb-1.5"
                            style={{ color: 'var(--hw-text-secondary)' }}
                          >
                            Priority
                          </label>
                          <Input
                            type="number"
                            min={1}
                            value={rule.priority}
                            onChange={(e) => updateRule(rule.id, { priority: parseInt(e.target.value) || 1 })}
                          />
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Example Conditions */}
          {rules.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-medium" style={{ color: 'var(--hw-text-secondary)' }}>
                Example Conditions
              </h4>
              <div className="grid grid-cols-1 gap-2">
                {[
                  { label: 'Own records only', expr: 'record.created_by == user.id' },
                  { label: 'Same department', expr: 'record.department == user.department' },
                  { label: 'Active records', expr: 'record.status == "active"' },
                  { label: 'Within date range', expr: 'record.created_at > context.thirtyDaysAgo' },
                ].map((example) => (
                  <div
                    key={example.label}
                    className="flex items-center justify-between p-2 rounded-lg text-xs"
                    style={{ backgroundColor: 'var(--hw-bg-subtle)' }}
                  >
                    <span style={{ color: 'var(--hw-text-muted)' }}>{example.label}</span>
                    <code
                      className="px-2 py-0.5 rounded font-mono"
                      style={{ backgroundColor: 'var(--hw-bg)', color: 'var(--hw-text-secondary)' }}
                    >
                      {example.expr}
                    </code>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-end gap-3 px-6 py-4 border-t"
          style={{ borderColor: 'var(--hw-border-subtle)' }}
        >
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => void handleSave()}
            loading={saving}
          >
            Save Rules
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AbacRulesDrawer;
