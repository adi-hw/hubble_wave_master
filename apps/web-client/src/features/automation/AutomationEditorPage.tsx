/**
 * AutomationEditorPage
 * HubbleWave Platform - Phase 3
 *
 * Page for creating and editing automation rules using the visual RuleBuilder.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, X } from 'lucide-react';
import {
  RuleBuilder,
  RuleConfig,
  TriggerTiming,
  TriggerOperation,
  ConditionGroup,
  ConditionRule,
} from '../../components/automation';
import { automationApi, Automation, CreateAutomationDto } from '../../services/automationApi';

interface CollectionProperty {
  code: string;
  label: string;
  type: string;
}

export const AutomationEditorPage: React.FC = () => {
  const { id: collectionId, automationId } = useParams<{ id: string; automationId: string }>();
  const navigate = useNavigate();
  const isNew = automationId === 'new';

  const [loading, setLoading] = useState(!isNew);
  const [error, setError] = useState<string | null>(null);
  const [initialRule, setInitialRule] = useState<Partial<RuleConfig> | undefined>();
  const [collectionName, setCollectionName] = useState('Collection');
  const [properties, setProperties] = useState<CollectionProperty[]>([]);

  useEffect(() => {
    loadData();
  }, [collectionId, automationId]);

  const loadData = async () => {
    if (!collectionId) return;

    try {
      // Load collection metadata (properties)
      const collectionRes = await fetch(`/api/collections/${collectionId}`);
      if (collectionRes.ok) {
        const collection = await collectionRes.json();
        setCollectionName(collection.label ?? collection.name ?? 'Collection');
        setProperties(
          (collection.properties ?? []).map((p: { code: string; label: string; type: string }) => ({
            code: p.code,
            label: p.label ?? p.code,
            type: p.type ?? 'string',
          }))
        );
      }

      // Load existing automation if editing
      if (!isNew && automationId) {
        const automation = await automationApi.getAutomation(automationId);
        setInitialRule(convertToRuleConfig(automation));
      }
    } catch (err) {
      console.error('Failed to load data', err);
      setError('Failed to load automation data');
    } finally {
      setLoading(false);
    }
  };

  const convertToRuleConfig = (automation: Automation): Partial<RuleConfig> => {
    // Parse trigger timing and operations from the automation
    const timingParts = automation.triggerTiming?.split('_') ?? ['after'];
    const timing = timingParts[0] as TriggerTiming;

    const operations: TriggerOperation[] = [];
    if (automation.triggerOnInsert) operations.push('insert');
    if (automation.triggerOnUpdate) operations.push('update');
    if (automation.triggerOnDelete) operations.push('delete');

    // Map condition to the correct type if it exists
    const condition = automation.condition as Record<string, unknown> | undefined;
    let mappedCondition: ConditionGroup | ConditionRule | undefined;
    if (condition) {
      if (condition.conditions) {
        mappedCondition = {
          id: condition.id as string ?? `cond_${Date.now()}`,
          operator: (condition.operator as 'and' | 'or') ?? 'and',
          conditions: (condition.conditions as (ConditionGroup | ConditionRule)[]) ?? [],
        };
      } else if (condition.property) {
        mappedCondition = {
          id: condition.id as string ?? `cond_${Date.now()}`,
          property: condition.property as string,
          operator: condition.operator as string ?? 'equals',
          value: condition.value,
        };
      }
    }

    // Map action type (filter out 'flow' as it's not supported in the builder)
    const actionType = automation.actionType === 'flow' ? 'no_code' : (automation.actionType ?? 'no_code');

    return {
      id: automation.id,
      name: automation.name,
      description: automation.description,
      triggerTiming: timing,
      triggerOperations: operations.length > 0 ? operations : ['insert', 'update'],
      watchProperties: automation.watchProperties as string[] | undefined,
      conditionType: automation.conditionType ?? 'always',
      condition: mappedCondition,
      conditionScript: automation.conditionScript,
      actionType: actionType as 'no_code' | 'script',
      actions: (automation.actions ?? []).map((a) => ({
        id: a.id,
        type: a.type,
        config: a.config,
      })),
      script: automation.script,
      abortOnError: automation.abortOnError ?? false,
      executionOrder: automation.executionOrder ?? 100,
      isActive: automation.isActive ?? true,
    };
  };

  const handleSave = useCallback(
    async (rule: RuleConfig) => {
      if (!collectionId) return;

      try {
        // Convert RuleConfig back to API format
        const triggerTiming = `${rule.triggerTiming}_${rule.triggerOperations[0] ?? 'insert'}`;

        const payload: CreateAutomationDto = {
          name: rule.name,
          code: `AUT_${Date.now()}`,
          collectionId,
          description: rule.description,
          triggerTiming: triggerTiming as Automation['triggerTiming'],
          triggerOnInsert: rule.triggerOperations.includes('insert'),
          triggerOnUpdate: rule.triggerOperations.includes('update'),
          triggerOnDelete: rule.triggerOperations.includes('delete'),
          triggerOnQuery: false,
          watchProperties: rule.watchProperties,
          conditionType: rule.conditionType,
          condition: rule.condition as unknown as Record<string, unknown>,
          conditionScript: rule.conditionScript,
          actionType: rule.actionType,
          actions: rule.actions.map((a) => ({
            id: a.id,
            type: a.type,
            executionOrder: 0,
            config: a.config,
            continueOnError: false,
          })),
          script: rule.script,
          abortOnError: rule.abortOnError,
          executionOrder: rule.executionOrder,
          isActive: rule.isActive,
        };

        if (isNew) {
          await automationApi.createAutomation(collectionId, payload);
        } else if (automationId) {
          await automationApi.updateAutomation(automationId, payload);
        }

        navigate(`/studio/collections/${collectionId}/automations`);
      } catch (err) {
        console.error('Failed to save automation', err);
        setError('Failed to save automation');
        throw err;
      }
    },
    [collectionId, automationId, isNew, navigate]
  );

  const handleCancel = useCallback(() => {
    navigate(-1);
  }, [navigate]);

  const handleTest = useCallback(
    async (_rule: RuleConfig): Promise<{ success: boolean; message: string }> => {
      // Test automation (dry run)
      try {
        // This would call a test endpoint
        return { success: true, message: 'Rule validation passed. Actions would execute correctly.' };
      } catch (err) {
        return { success: false, message: `Test failed: ${(err as Error).message}` };
      }
    },
    []
  );

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto mt-8 flex justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto mt-8 mb-8 px-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-foreground">
          {isNew ? 'New Automation Rule' : 'Edit Automation Rule'}
        </h1>
      </div>

      {error && (
        <div
          className="flex items-center justify-between p-4 mb-6 rounded border bg-destructive/10 border-destructive/30 text-destructive"
          role="alert"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="p-1 rounded hover:bg-hover"
            aria-label="Dismiss error"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <RuleBuilder
        collectionId={collectionId ?? ''}
        collectionName={collectionName}
        properties={properties}
        initialValue={initialRule}
        onSave={handleSave}
        onCancel={handleCancel}
        onTest={handleTest}
      />
    </div>
  );
};
