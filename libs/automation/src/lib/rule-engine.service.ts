import { Injectable, Logger } from '@nestjs/common';
import {
  TenantDbService,
  BusinessRule,
  RuleTrigger,
  ConditionExpression,
  ActionConfig,
  FieldMapping,
} from '@eam-platform/tenant-db';
import { IsNull } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';

export interface RuleContext {
  tenantId: string;
  userId: string;
  tableName: string;
  trigger: RuleTrigger;
  record: Record<string, unknown>;
  previousRecord?: Record<string, unknown>;
  changedFields?: string[];
}

export interface RuleResult {
  ruleId: string;
  ruleCode: string;
  success: boolean;
  error?: string;
  modifications?: Record<string, unknown>;
  aborted?: boolean;
  abortMessage?: string;
}

export interface ExecutionResult {
  success: boolean;
  record: Record<string, unknown>;
  results: RuleResult[];
  aborted: boolean;
  abortMessage?: string;
}

@Injectable()
export class RuleEngineService {
  private readonly logger = new Logger(RuleEngineService.name);

  constructor(
    private readonly tenantDb: TenantDbService,
    private readonly eventEmitter: EventEmitter2
  ) {}

  /**
   * Execute all applicable business rules for a record operation
   */
  async executeRules(ctx: RuleContext): Promise<ExecutionResult> {
    const results: RuleResult[] = [];
    let record = { ...ctx.record };
    let aborted = false;
    let abortMessage: string | undefined;

    try {
      // Get applicable rules ordered by execution order
      const rules = await this.getApplicableRules(ctx);

      this.logger.debug(
        `Executing ${rules.length} rules for ${ctx.tableName}.${ctx.trigger}`
      );

      for (const rule of rules) {
        if (aborted) break;

        try {
          // Check if rule condition is met
          const conditionMet = await this.evaluateCondition(rule, ctx, record);

          if (!conditionMet) {
            results.push({
              ruleId: rule.id,
              ruleCode: rule.code,
              success: true,
            });
            continue;
          }

          // Execute the rule action
          const result = await this.executeAction(rule, ctx, record);

          if (result.aborted) {
            aborted = true;
            abortMessage = result.abortMessage;
          }

          if (result.modifications) {
            record = { ...record, ...result.modifications };
          }

          results.push(result);
        } catch (error: any) {
          const errorResult: RuleResult = {
            ruleId: rule.id,
            ruleCode: rule.code,
            success: false,
            error: error.message,
          };

          results.push(errorResult);

          // Handle error based on rule configuration
          if (rule.onError === 'abort') {
            aborted = true;
            abortMessage = rule.errorMessage || `Rule ${rule.code} failed: ${error.message}`;
            break;
          } else if (rule.onError === 'notify_admin') {
            this.eventEmitter.emit('rule.error', {
              tenantId: ctx.tenantId,
              ruleId: rule.id,
              ruleCode: rule.code,
              error: error.message,
              context: ctx,
            });
          }
          // 'log_continue' - just log and continue (already logged above)
        }
      }
    } catch (error: any) {
      this.logger.error(`Rule engine error: ${error.message}`, error.stack);
      return {
        success: false,
        record,
        results,
        aborted: true,
        abortMessage: error.message,
      };
    }

    return {
      success: !aborted,
      record,
      results,
      aborted,
      abortMessage,
    };
  }

  /**
   * Get all rules applicable to a given context
   */
  private async getApplicableRules(ctx: RuleContext): Promise<BusinessRule[]> {
    const dataSource = await this.tenantDb.getDataSource(ctx.tenantId);
    const ruleRepo = dataSource.getRepository(BusinessRule);

    return ruleRepo.find({
      where: [
        // Tenant-specific rules
        { tenantId: ctx.tenantId, targetTable: ctx.tableName, trigger: ctx.trigger, isActive: true, deletedAt: IsNull() },
        // Platform rules (tenantId is null)
        { tenantId: IsNull(), targetTable: ctx.tableName, trigger: ctx.trigger, isActive: true, deletedAt: IsNull() },
      ],
      order: { executionOrder: 'ASC' },
    });
  }

  /**
   * Evaluate rule condition
   */
  private async evaluateCondition(
    rule: BusinessRule,
    ctx: RuleContext,
    currentRecord: Record<string, unknown>
  ): Promise<boolean> {
    switch (rule.conditionType) {
      case 'always':
        return true;

      case 'field_changed':
        return this.evaluateFieldChanged(rule.watchFields || [], ctx);

      case 'condition_met':
        return this.evaluateExpression(rule.conditionExpression, currentRecord, ctx.previousRecord);

      case 'script':
        return this.evaluateConditionScript(rule.conditionScript || '', currentRecord, ctx);

      default:
        return false;
    }
  }

  /**
   * Check if any watched fields have changed
   */
  private evaluateFieldChanged(watchFields: string[], ctx: RuleContext): boolean {
    if (!ctx.changedFields || ctx.changedFields.length === 0) return false;
    if (!watchFields || watchFields.length === 0) return true; // Any change triggers

    return watchFields.some((field) => ctx.changedFields!.includes(field));
  }

  /**
   * Evaluate declarative condition expression
   */
  private evaluateExpression(
    expr: ConditionExpression | undefined,
    record: Record<string, unknown>,
    previousRecord?: Record<string, unknown>
  ): boolean {
    if (!expr) return true;

    if (expr.conditions && expr.conditions.length > 0) {
      // Nested boolean expression
      const results = expr.conditions.map((c) =>
        this.evaluateExpression(c, record, previousRecord)
      );

      switch (expr.operator) {
        case 'and':
          return results.every((r) => r);
        case 'or':
          return results.some((r) => r);
        case 'not':
          return !results[0];
        default:
          return false;
      }
    }

    // Leaf condition - field comparison
    if (!expr.field || !expr.comparison) return true;

    const fieldValue = record[expr.field];
    const previousValue = previousRecord?.[expr.field];

    return this.compareValues(expr.comparison, fieldValue, expr.value, previousValue);
  }

  /**
   * Compare values based on comparison operator
   */
  private compareValues(
    comparison: string,
    fieldValue: unknown,
    compareValue: unknown,
    previousValue?: unknown
  ): boolean {
    switch (comparison) {
      case 'eq':
        return fieldValue === compareValue;
      case 'ne':
        return fieldValue !== compareValue;
      case 'gt':
        return Number(fieldValue) > Number(compareValue);
      case 'gte':
        return Number(fieldValue) >= Number(compareValue);
      case 'lt':
        return Number(fieldValue) < Number(compareValue);
      case 'lte':
        return Number(fieldValue) <= Number(compareValue);
      case 'in':
        return Array.isArray(compareValue) && compareValue.includes(fieldValue);
      case 'nin':
        return Array.isArray(compareValue) && !compareValue.includes(fieldValue);
      case 'contains':
        return String(fieldValue).includes(String(compareValue));
      case 'starts_with':
        return String(fieldValue).startsWith(String(compareValue));
      case 'ends_with':
        return String(fieldValue).endsWith(String(compareValue));
      case 'is_null':
        return fieldValue === null || fieldValue === undefined;
      case 'is_not_null':
        return fieldValue !== null && fieldValue !== undefined;
      case 'changed':
        return fieldValue !== previousValue;
      case 'changed_to':
        return previousValue !== compareValue && fieldValue === compareValue;
      case 'changed_from':
        return previousValue === compareValue && fieldValue !== compareValue;
      default:
        return false;
    }
  }

  /**
   * Evaluate script-based condition (sandboxed)
   */
  private async evaluateConditionScript(
    script: string,
    record: Record<string, unknown>,
    ctx: RuleContext
  ): Promise<boolean> {
    // Delegate to script sandbox
    try {
      const result = await this.executeScript(script, {
        current: record,
        previous: ctx.previousRecord,
        changedFields: ctx.changedFields,
        user: { id: ctx.userId },
      });
      return Boolean(result);
    } catch (error) {
      this.logger.warn(`Condition script failed: ${error}`);
      return false;
    }
  }

  /**
   * Execute rule action
   */
  private async executeAction(
    rule: BusinessRule,
    ctx: RuleContext,
    record: Record<string, unknown>
  ): Promise<RuleResult> {
    const result: RuleResult = {
      ruleId: rule.id,
      ruleCode: rule.code,
      success: true,
    };

    switch (rule.actionType) {
      case 'set_value':
        result.modifications = await this.executeSetValue(rule.actionConfig, record, ctx);
        break;

      case 'validate':
        const validation = await this.executeValidation(rule.actionConfig, record);
        if (!validation.valid) {
          result.success = false;
          result.aborted = true;
          result.abortMessage = validation.message;
        }
        break;

      case 'abort':
        result.aborted = true;
        result.abortMessage = rule.errorMessage || 'Operation aborted by business rule';
        break;

      case 'script':
        const scriptResult = await this.executeActionScript(rule, record, ctx);
        if (scriptResult.modifications) {
          result.modifications = scriptResult.modifications;
        }
        if (scriptResult.aborted) {
          result.aborted = true;
          result.abortMessage = scriptResult.message;
        }
        break;

      case 'workflow':
        await this.triggerWorkflow(rule.actionConfig, record, ctx);
        break;

      case 'notification':
        await this.sendNotification(rule.actionConfig, record, ctx);
        break;

      case 'api_call':
        await this.executeApiCall(rule.actionConfig, record, ctx);
        break;
    }

    return result;
  }

  /**
   * Execute set_value action - update field values
   */
  private async executeSetValue(
    config: ActionConfig,
    record: Record<string, unknown>,
    ctx: RuleContext
  ): Promise<Record<string, unknown>> {
    const modifications: Record<string, unknown> = {};

    if (!config.fieldMappings) return modifications;

    for (const mapping of config.fieldMappings) {
      modifications[mapping.targetField] = await this.resolveFieldValue(
        mapping,
        record,
        ctx
      );
    }

    return modifications;
  }

  /**
   * Resolve field value from mapping
   */
  private async resolveFieldValue(
    mapping: FieldMapping,
    record: Record<string, unknown>,
    ctx: RuleContext
  ): Promise<unknown> {
    switch (mapping.sourceType) {
      case 'value':
        return mapping.sourceValue;

      case 'field':
        return record[mapping.sourceValue];

      case 'expression':
        return this.evaluateFieldExpression(mapping.sourceValue, record, ctx);

      case 'script':
        return this.executeScript(mapping.sourceValue, {
          current: record,
          previous: ctx.previousRecord,
          user: { id: ctx.userId },
        });

      default:
        return mapping.sourceValue;
    }
  }

  /**
   * Evaluate field expression (simple template interpolation)
   */
  private evaluateFieldExpression(
    expression: string,
    record: Record<string, unknown>,
    ctx: RuleContext
  ): unknown {
    // Handle special expressions
    if (expression === '$now') return new Date();
    if (expression === '$userId') return ctx.userId;
    if (expression === '$tenantId') return ctx.tenantId;

    // Template interpolation: {{field_name}}
    return expression.replace(/\{\{(\w+)\}\}/g, (_, field) => {
      return String(record[field] ?? '');
    });
  }

  /**
   * Execute validation action
   */
  private async executeValidation(
    config: ActionConfig,
    record: Record<string, unknown>
  ): Promise<{ valid: boolean; message?: string }> {
    if (!config.validationRules) return { valid: true };

    for (const rule of config.validationRules) {
      const value = record[rule.field];

      switch (rule.rule) {
        case 'required':
          if (value === null || value === undefined || value === '') {
            return { valid: false, message: rule.message };
          }
          break;

        case 'email':
          if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value))) {
            return { valid: false, message: rule.message };
          }
          break;

        case 'regex':
          if (value && !new RegExp(rule.params).test(String(value))) {
            return { valid: false, message: rule.message };
          }
          break;

        case 'min':
          if (Number(value) < Number(rule.params)) {
            return { valid: false, message: rule.message };
          }
          break;

        case 'max':
          if (Number(value) > Number(rule.params)) {
            return { valid: false, message: rule.message };
          }
          break;

        case 'custom':
          const result = await this.executeScript(rule.params, { value, record });
          if (!result) {
            return { valid: false, message: rule.message };
          }
          break;
      }
    }

    return { valid: true };
  }

  /**
   * Execute script action
   */
  private async executeActionScript(
    rule: BusinessRule,
    record: Record<string, unknown>,
    ctx: RuleContext
  ): Promise<{ modifications?: Record<string, unknown>; aborted?: boolean; message?: string }> {
    if (!rule.actionScript) return {};

    const result = await this.executeScript(rule.actionScript, {
      current: record,
      previous: ctx.previousRecord,
      changedFields: ctx.changedFields,
      user: { id: ctx.userId },
      abort: (message: string) => ({ __abort: true, message }),
      setValue: (field: string, value: unknown) => ({ __setValue: { field, value } }),
    });

    const scriptResult = result as Record<string, unknown> | null;
    if (scriptResult?.['__abort']) {
      return { aborted: true, message: scriptResult['message'] as string };
    }

    if (scriptResult?.['__setValue']) {
      const setValue = scriptResult['__setValue'] as { field: string; value: unknown };
      return { modifications: { [setValue.field]: setValue.value } };
    }

    if (typeof result === 'object' && result !== null) {
      return { modifications: result as Record<string, unknown> };
    }

    return {};
  }

  /**
   * Trigger workflow
   */
  private async triggerWorkflow(
    config: ActionConfig,
    record: Record<string, unknown>,
    ctx: RuleContext
  ): Promise<void> {
    if (!config.workflowCode) return;

    // Build workflow input from mapping
    const input: Record<string, unknown> = {};
    if (config.workflowInputMapping) {
      for (const [key, value] of Object.entries(config.workflowInputMapping)) {
        input[key] = record[value] ?? value;
      }
    } else {
      input['record'] = record;
    }

    // Emit event for workflow engine to pick up
    this.eventEmitter.emit('workflow.trigger', {
      tenantId: ctx.tenantId,
      workflowCode: config.workflowCode,
      input,
      triggeredBy: ctx.userId,
      source: 'business_rule',
    });
  }

  /**
   * Send notification
   */
  private async sendNotification(
    config: ActionConfig,
    record: Record<string, unknown>,
    ctx: RuleContext
  ): Promise<void> {
    if (!config.templateCode) return;

    // Resolve recipients
    let recipients: string[] = [];
    if (typeof config.recipients === 'string') {
      // Field reference
      const value = record[config.recipients];
      recipients = Array.isArray(value) ? value.map(String) : [String(value)];
    } else if (Array.isArray(config.recipients)) {
      recipients = config.recipients;
    }

    this.eventEmitter.emit('notification.send', {
      tenantId: ctx.tenantId,
      templateCode: config.templateCode,
      recipients,
      data: record,
      triggeredBy: ctx.userId,
    });
  }

  /**
   * Execute external API call
   */
  private async executeApiCall(
    config: ActionConfig,
    record: Record<string, unknown>,
    ctx: RuleContext
  ): Promise<void> {
    if (!config.endpoint) return;

    // Build request body from mapping
    const body: Record<string, unknown> = {};
    if (config.bodyMapping) {
      for (const [key, value] of Object.entries(config.bodyMapping)) {
        body[key] = record[value] ?? value;
      }
    }

    this.eventEmitter.emit('api.call', {
      tenantId: ctx.tenantId,
      endpoint: config.endpoint,
      method: config.method || 'POST',
      headers: config.headers,
      body,
      triggeredBy: ctx.userId,
    });
  }

  /**
   * Execute script in sandbox (placeholder - will be enhanced)
   */
  private async executeScript(
    script: string,
    context: Record<string, unknown>
  ): Promise<unknown> {
    // Basic sandbox using Function constructor
    // In production, use isolated-vm or similar for true isolation
    try {
      const fn = new Function(
        ...Object.keys(context),
        `"use strict"; return (async () => { ${script} })();`
      );
      return await fn(...Object.values(context));
    } catch (error: any) {
      this.logger.error(`Script execution failed: ${error.message}`);
      throw error;
    }
  }
}
