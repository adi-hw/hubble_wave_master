/**
 * RuleBuilder Component
 * HubbleWave Platform - Phase 3
 *
 * Production-ready business rule builder with:
 * - Visual rule configuration
 * - Trigger, condition, and action management
 * - Theme-aware styling
 * - WCAG 2.1 AA accessibility compliance
 */

import React, { useState, useCallback } from 'react';
import { Save, Play, X, ChevronDown, ChevronUp } from 'lucide-react';
import { TriggerBuilder } from './TriggerBuilder';
import { AutomationConditionBuilder } from './AutomationConditionBuilder';
import { ActionBuilder, AutomationActionConfig } from './ActionBuilder';

export type TriggerTiming = 'before' | 'after' | 'async';
export type TriggerOperation = 'insert' | 'update' | 'delete';

export interface RuleConfig {
  id?: string;
  name: string;
  description?: string;
  triggerTiming: TriggerTiming;
  triggerOperations: TriggerOperation[];
  watchProperties?: string[];
  conditionType: 'always' | 'condition' | 'script';
  condition?: ConditionGroup | ConditionRule;
  conditionScript?: string;
  actionType: 'no_code' | 'script';
  actions: AutomationActionConfig[];
  script?: string;
  abortOnError: boolean;
  executionOrder: number;
  isActive: boolean;
}

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

interface RuleBuilderProps {
  collectionId: string;
  collectionName: string;
  properties: Array<{ code: string; label: string; type: string }>;
  initialValue?: Partial<RuleConfig>;
  onSave: (rule: RuleConfig) => Promise<void>;
  onCancel: () => void;
  onTest?: (rule: RuleConfig) => Promise<{ success: boolean; message: string }>;
}

export const RuleBuilder: React.FC<RuleBuilderProps> = ({
  collectionId,
  collectionName,
  properties,
  initialValue,
  onSave,
  onCancel,
  onTest,
}) => {
  const [rule, setRule] = useState<RuleConfig>({
    name: initialValue?.name ?? '',
    description: initialValue?.description ?? '',
    triggerTiming: initialValue?.triggerTiming ?? 'after',
    triggerOperations: initialValue?.triggerOperations ?? ['insert', 'update'],
    watchProperties: initialValue?.watchProperties,
    conditionType: initialValue?.conditionType ?? 'always',
    condition: initialValue?.condition,
    conditionScript: initialValue?.conditionScript,
    actionType: initialValue?.actionType ?? 'no_code',
    actions: initialValue?.actions ?? [],
    script: initialValue?.script,
    abortOnError: initialValue?.abortOnError ?? false,
    executionOrder: initialValue?.executionOrder ?? 100,
    isActive: initialValue?.isActive ?? true,
    id: initialValue?.id,
  });

  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const updateRule = useCallback(<K extends keyof RuleConfig>(key: K, value: RuleConfig[K]) => {
    setRule((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await onSave(rule);
    } finally {
      setSaving(false);
    }
  }, [rule, onSave]);

  const handleTest = useCallback(async () => {
    if (!onTest) return;
    setTesting(true);
    setTestResult(null);
    try {
      const result = await onTest(rule);
      setTestResult(result);
    } finally {
      setTesting(false);
    }
  }, [rule, onTest]);

  return (
    <form
      className="flex flex-col gap-6 p-6 max-w-[1200px] mx-auto rounded-lg shadow-md border bg-card border-border"
      role="form"
      aria-label="Business Rule Builder"
      onSubmit={(e) => {
        e.preventDefault();
        handleSave();
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-4 p-4 rounded bg-muted">
        <input
          type="text"
          placeholder="Rule Name"
          value={rule.name}
          onChange={(e) => updateRule('name', e.target.value)}
          required
          className="flex-1 bg-transparent border-b border-border text-xl font-semibold text-foreground focus:outline-none focus:border-b-2"
          aria-label="Rule name"
        />
        <label className="flex items-center gap-2 cursor-pointer">
          <span className="text-sm text-muted-foreground">Active</span>
          <button
            type="button"
            role="switch"
            aria-checked={rule.isActive}
            onClick={() => updateRule('isActive', !rule.isActive)}
            className={`toggle-track h-6 w-11 ${rule.isActive ? 'toggle-track-on' : ''}`}
          >
            <span
              className={`toggle-thumb inline-block h-4 w-4 transform ${
                rule.isActive ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </label>
      </div>

      {/* WHEN - Trigger Section */}
      <div className="rounded p-5 border bg-muted border-border">
        <h3 className="font-semibold mb-4 uppercase tracking-wide text-sm text-foreground">
          WHEN
        </h3>
        <TriggerBuilder
          timing={rule.triggerTiming}
          operations={rule.triggerOperations}
          watchProperties={rule.watchProperties}
          collectionName={collectionName}
          properties={properties}
          onTimingChange={(timing) => updateRule('triggerTiming', timing)}
          onOperationsChange={(ops) => updateRule('triggerOperations', ops)}
          onWatchPropertiesChange={(props) => updateRule('watchProperties', props)}
        />
      </div>

      {/* IF - Condition Section */}
      <div className="rounded p-5 border bg-muted border-border">
        <h3 className="font-semibold mb-4 uppercase tracking-wide text-sm text-foreground">
          IF (Conditions)
        </h3>
        <AutomationConditionBuilder
          conditionType={rule.conditionType}
          condition={rule.condition}
          conditionScript={rule.conditionScript}
          properties={properties}
          onConditionTypeChange={(type) => updateRule('conditionType', type)}
          onConditionChange={(condition) => updateRule('condition', condition)}
          onConditionScriptChange={(script) => updateRule('conditionScript', script)}
        />
      </div>

      {/* THEN - Actions Section */}
      <div className="rounded p-5 border bg-muted border-border">
        <h3 className="font-semibold mb-4 uppercase tracking-wide text-sm text-foreground">
          THEN (Actions)
        </h3>
        <ActionBuilder
          actionType={rule.actionType}
          actions={rule.actions}
          script={rule.script}
          properties={properties}
          collectionId={collectionId}
          onActionTypeChange={(type) => updateRule('actionType', type)}
          onActionsChange={(actions) => updateRule('actions', actions)}
          onScriptChange={(script) => updateRule('script', script)}
        />
      </div>

      {/* Advanced Options */}
      <div className="rounded overflow-hidden border bg-muted border-border">
        <button
          type="button"
          className="w-full flex items-center justify-between p-4 cursor-pointer"
          onClick={() => setAdvancedOpen(!advancedOpen)}
          onKeyDown={(e) => e.key === 'Enter' && setAdvancedOpen(!advancedOpen)}
          aria-expanded={advancedOpen}
          aria-controls="advanced-options"
        >
          <span className="font-semibold text-sm text-foreground">
            ADVANCED OPTIONS
          </span>
          {advancedOpen ? (
            <ChevronUp className="w-5 h-5 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-5 h-5 text-muted-foreground" />
          )}
        </button>
        {advancedOpen && (
          <div id="advanced-options" className="px-4 pb-4 flex flex-col gap-4">
            <div>
              <label className="block text-xs font-medium mb-1 text-muted-foreground">
                Description
              </label>
              <textarea
                rows={2}
                value={rule.description}
                onChange={(e) => updateRule('description', e.target.value)}
                className="w-full px-3 py-2 text-sm rounded border bg-card border-border text-foreground focus:outline-none focus:ring-2"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 text-muted-foreground">
                Execution Order
              </label>
              <input
                type="number"
                value={rule.executionOrder}
                onChange={(e) => updateRule('executionOrder', parseInt(e.target.value, 10) || 100)}
                className="max-w-[200px] px-3 py-1.5 text-sm rounded border bg-card border-border text-foreground focus:outline-none focus:ring-2"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Lower numbers execute first
              </p>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <button
                type="button"
                role="switch"
                aria-checked={rule.abortOnError}
                onClick={() => updateRule('abortOnError', !rule.abortOnError)}
                className={`toggle-track h-5 w-9 ${rule.abortOnError ? 'toggle-track-on' : ''}`}
              >
                <span
                  className={`toggle-thumb inline-block h-3 w-3 transform ${
                    rule.abortOnError ? 'translate-x-5' : 'translate-x-1'
                  }`}
                />
              </button>
              <span className="text-sm text-foreground">
                Abort transaction on error
              </span>
            </label>
          </div>
        )}
      </div>

      {/* Test Result */}
      {testResult && (
        <div
          className={`p-4 rounded ${
            testResult.success
              ? 'bg-success-subtle text-success-text'
              : 'bg-danger-subtle text-danger-text'
          }`}
          role="alert"
        >
          <p>{testResult.message}</p>
        </div>
      )}

      {/* Footer Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t border-border">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded border border-border text-foreground transition-colors hover:bg-muted"
        >
          <X className="w-4 h-4" />
          Cancel
        </button>
        {onTest && (
          <button
            type="button"
            onClick={handleTest}
            disabled={testing || !rule.name}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded border border-border text-foreground transition-colors hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Play className="w-4 h-4" />
            {testing ? 'Testing...' : 'Test Rule'}
          </button>
        )}
        <button
          type="submit"
          disabled={saving || !rule.name}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saving...' : 'Save Rule'}
        </button>
      </div>
    </form>
  );
};
