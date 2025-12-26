import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  ExecutionContext,
  ExecutionResult,
  ActionExecutionResult,
  QueuedAction,
  TriggerTiming,
} from '../../types/automation.types';
import { Automation } from './automation.service';
import { ConditionEvaluatorService } from './condition-evaluator.service';
import { ActionHandlerService } from './action-handler.service';
import { AutomationService } from './automation.service';
import { ExecutionLogService } from './execution-log.service';
import { ScriptSandboxService } from './script-sandbox.service';

const MAX_DEPTH = 5;
const MAX_AUTOMATIONS_PER_REQUEST = 50;

@Injectable()
export class AutomationExecutorService {
  private readonly logger = new Logger(AutomationExecutorService.name);

  constructor(
    private readonly automationService: AutomationService,
    private readonly conditionEvaluator: ConditionEvaluatorService,
    private readonly actionHandler: ActionHandlerService,
    private readonly executionLog: ExecutionLogService,
    private readonly scriptSandbox: ScriptSandboxService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Execute all automations for a given trigger
   */
  async executeAutomations(
    collectionId: string,
    timing: TriggerTiming,
    operation: 'insert' | 'update' | 'delete' | 'query',
    record: Record<string, unknown>,
    previousRecord: Record<string, unknown> | undefined,
    userContext: ExecutionContext['user'],
    tenantId: string,
    parentContext?: Partial<ExecutionContext>,
  ): Promise<{
    modifiedRecord: Record<string, unknown>;
    errors: Array<{ property: string; message: string }>;
    warnings: Array<{ property: string; message: string }>;
    asyncQueue: QueuedAction[];
    aborted: boolean;
    abortMessage?: string;
  }> {
    const startTime = Date.now();
    
    // Initialize or inherit execution context
    const context: ExecutionContext = {
      tenantId,
      user: userContext,
      record: { ...record },
      previousRecord,
      changes: previousRecord ? this.calculateChanges(record, previousRecord) : [],
      automation: null as any, // Set per automation
      depth: (parentContext?.depth || 0) + 1,
      maxDepth: MAX_DEPTH,
      executionChain: [...(parentContext?.executionChain || [])],
      recordsModified: parentContext?.recordsModified || new Map(),
      outputs: {},
      asyncQueue: [],
      errors: [],
      warnings: [],
    };

    // Check depth limit
    if (context.depth > MAX_DEPTH) {
      this.logger.warn(`Max automation depth exceeded for collection ${collectionId}`);
      return {
        modifiedRecord: record,
        errors: [],
        warnings: [{ property: '_automation', message: 'Max automation depth exceeded' }],
        asyncQueue: [],
        aborted: false,
      };
    }

    // Load automations for this trigger
    const automations = await this.automationService.getAutomationsForTrigger(
      collectionId,
      timing,
      operation,
    );

    let automationsExecuted = 0;
    let aborted = false;
    let abortMessage: string | undefined;

    for (const automation of automations) {
      // Check execution limit
      if (automationsExecuted >= MAX_AUTOMATIONS_PER_REQUEST) {
        this.logger.warn(`Max automations per request exceeded for collection ${collectionId}`);
        break;
      }

      // Check for circular reference
      if (context.executionChain.includes(automation.id)) {
        this.logger.warn(`Circular automation reference detected: ${automation.id}`);
        await this.executionLog.log({
          automationId: automation.id,
          automationType: 'data',
          automationName: automation.name,
          collectionId,
          recordId: record.id as string,
          triggerEvent: operation,
          triggerTiming: timing,
          status: 'skipped',
          skippedReason: 'Circular reference detected',
          triggeredBy: userContext.id,
          executionDepth: context.depth,
        });
        continue;
      }

      // Check watch properties for updates
      if (operation === 'update' && (automation.watchProperties?.length ?? 0) > 0) {
        const watchedChanged = automation.watchProperties!.some((prop) =>
          context.changes.includes(prop),
        );
        if (!watchedChanged) {
          continue; // Skip - no watched property changed
        }
      }

      // Set automation context
      context.automation = {
        id: automation.id,
        name: automation.name,
        triggerTiming: automation.triggerTiming,
        abortOnError: automation.abortOnError,
      };
      context.executionChain.push(automation.id);

      try {
        const result = await this.executeAutomation(automation, context);
        automationsExecuted++;

        if (result.status === 'success') {
          // Apply record modifications
          if (result.modifiedRecord) {
            context.record = result.modifiedRecord;
          }
          // Collect async actions
          context.asyncQueue.push(...result.asyncQueue);
          // Collect warnings
          context.warnings.push(...result.warnings);
        } else if (result.status === 'error') {
          if (automation.abortOnError) {
            aborted = true;
            abortMessage = result.errors[0]?.message || 'Automation failed';
            break;
          }
          context.errors.push(...result.errors);
        }

        // Check for abort action
        if (result.aborted) {
          aborted = true;
          abortMessage = result.abortMessage;
          break;
        }
      } catch (err) {
        const error = err as Error;
        this.logger.error(`Automation ${automation.id} failed:`, error);

        await this.executionLog.log({
          automationId: automation.id,
          automationType: 'data',
          automationName: automation.name,
          collectionId,
          recordId: record.id as string,
          triggerEvent: operation,
          triggerTiming: timing,
          status: 'error',
          errorMessage: error.message,
          errorStack: error.stack,
          triggeredBy: userContext.id,
          executionDepth: context.depth,
          durationMs: Date.now() - startTime,
        });

        // Update error tracking
        await this.trackError(automation.id);

        if (automation.abortOnError) {
          throw error;
        }
      }

      // Remove from chain after execution
      context.executionChain.pop();
    }

    return {
      modifiedRecord: context.record,
      errors: context.errors,
      warnings: context.warnings,
      asyncQueue: context.asyncQueue,
      aborted,
      abortMessage,
    };
  }

  /**
   * Execute a single automation
   */
  private async executeAutomation(
    automation: Automation,
    context: ExecutionContext,
  ): Promise<ExecutionResult & { aborted?: boolean; abortMessage?: string }> {
    const startTime = Date.now();
    const actionsExecuted: ActionExecutionResult[] = [];
    let aborted = false;
    let abortMessage: string | undefined;

    // Evaluate condition
    if (automation.conditionType !== 'always') {
      const conditionResult = await this.evaluateCondition(automation, context);
      
      if (!conditionResult.result) {
        await this.executionLog.log({
          automationId: automation.id,
          automationType: 'data',
          automationName: automation.name,
          collectionId: automation.collectionId,
          recordId: context.record.id as string,
          triggerEvent: context.automation.triggerTiming,
          triggerTiming: automation.triggerTiming,
          status: 'skipped',
          skippedReason: 'Condition not met',
          inputData: { condition: automation.condition, evaluation: conditionResult.trace },
          triggeredBy: context.user.id,
          executionDepth: context.depth,
          durationMs: Date.now() - startTime,
        });

        return {
          success: true,
          automationId: automation.id,
          status: 'skipped',
          skippedReason: 'Condition not met',
          asyncQueue: [],
          errors: [],
          warnings: [],
          actionsExecuted: [],
          durationMs: Date.now() - startTime,
        };
      }
    }

    // Execute actions
    const asyncQueue: QueuedAction[] = [];
    const errors: Array<{ property: string; message: string }> = [];
    const warnings: Array<{ property: string; message: string }> = [];
    let modifiedRecord = { ...context.record };

    if (automation.actionType === 'no_code' && automation.actions) {
      for (const action of automation.actions) {
        const actionStart = Date.now();

        // Check per-action condition
        if (action.condition) {
          const actionCondition = this.conditionEvaluator.evaluate(
            action.condition as any,
            { ...context, record: modifiedRecord },
          );
          if (!actionCondition.result) {
            actionsExecuted.push({
              actionId: action.id,
              actionType: action.type,
              success: true,
              output: 'Skipped - condition not met',
              durationMs: Date.now() - actionStart,
            });
            continue;
          }
        }

        try {
          const result = await this.actionHandler.execute(action as any, {
            ...context,
            record: modifiedRecord,
          });

          actionsExecuted.push({
            actionId: action.id,
            actionType: action.type,
            success: true,
            output: result.output,
            durationMs: Date.now() - actionStart,
          });

          // Handle action results
          if (result.type === 'modify_record') {
            modifiedRecord = { ...modifiedRecord, ...result.changes };
          } else if (result.type === 'abort') {
            aborted = true;
            abortMessage = result.message;
            break;
          } else if (result.type === 'add_error') {
            errors.push({ property: result.property!, message: result.message! });
          } else if (result.type === 'add_warning') {
            warnings.push({ property: result.property!, message: result.message! });
          } else if (result.type === 'queue_async') {
            asyncQueue.push({
              action: action as any,
              executeAsync: true,
              executeAfterCommit: false,
            });
          } else if (result.type === 'queue_after_commit') {
            asyncQueue.push({
              action: action as any,
              executeAsync: false,
              executeAfterCommit: true,
            });
          }
        } catch (err) {
          const error = err as Error;
          actionsExecuted.push({
            actionId: action.id,
            actionType: action.type,
            success: false,
            error: error.message,
            durationMs: Date.now() - actionStart,
          });

          if (!action.continueOnError && automation.abortOnError) {
            throw error;
          }
        }
      }
    } else if (automation.actionType === 'script' && automation.script) {
      // Execute script
      const scriptResult = await this.executeScript(automation.script, context);
      
      if (scriptResult.changes) {
        modifiedRecord = { ...modifiedRecord, ...scriptResult.changes };
      }
      
      actionsExecuted.push({
        actionId: 'script',
        actionType: 'run_script',
        success: !scriptResult.error,
        error: scriptResult.error,
        output: scriptResult.output,
        durationMs: scriptResult.durationMs,
      });
    }

    // Log execution
    await this.executionLog.log({
      automationId: automation.id,
      automationType: 'data',
      automationName: automation.name,
      collectionId: automation.collectionId,
      recordId: context.record.id as string,
      triggerEvent: context.automation.triggerTiming,
      triggerTiming: automation.triggerTiming,
      status: errors.length > 0 ? 'error' : 'success',
      inputData: context.record,
      outputData: modifiedRecord,
      actionsExecuted: actionsExecuted as unknown as Record<string, unknown>[],
      triggeredBy: context.user.id,
      executionDepth: context.depth,
      durationMs: Date.now() - startTime,
    });

    // Reset error tracking on success
    if (errors.length === 0) {
      await this.resetErrorTracking(automation.id);
    }

    return {
      success: errors.length === 0,
      automationId: automation.id,
      status: errors.length > 0 ? 'error' : 'success',
      modifiedRecord,
      asyncQueue,
      errors,
      warnings,
      actionsExecuted,
      durationMs: Date.now() - startTime,
      aborted,
      abortMessage,
    };
  }

  /**
   * Evaluate automation condition
   */
  private async evaluateCondition(
    automation: Automation,
    context: ExecutionContext,
  ): Promise<{ result: boolean; trace: Record<string, unknown> }> {
    if (automation.conditionType === 'condition') {
      // It is important that automation.condition is not null if conditionType is 'condition'
      // The entity logic/validation should ensure this, but we use ! operator here
      return this.conditionEvaluator.evaluate(automation.condition as any, context);
    } else if (automation.conditionType === 'script') {
      const result = await this.executeScript(automation.conditionScript!, context);
      return {
        result: Boolean(result.output),
        trace: { scriptOutput: result.output },
      };
    }
    return { result: true, trace: {} };
  }

  /**
   * Execute script in sandbox
   */
  private async executeScript(
    script: string,
    context: ExecutionContext,
  ): Promise<{ output: unknown; changes?: Record<string, unknown>; error?: string; durationMs: number }> {
    return this.scriptSandbox.execute(script, context);
  }

  /**
   * Calculate changed properties
   */
  private calculateChanges(
    current: Record<string, unknown>,
    previous: Record<string, unknown>,
  ): string[] {
    const changes: string[] = [];
    const allKeys = new Set([...Object.keys(current), ...Object.keys(previous)]);
    
    for (const key of allKeys) {
      if (JSON.stringify(current[key]) !== JSON.stringify(previous[key])) {
        changes.push(key);
      }
    }
    
    return changes;
  }

  /**
   * Track consecutive errors
   */
  private async trackError(automationId: string): Promise<void> {
    // Increment consecutive errors
    // If >= 5, pause the automation
    this.eventEmitter.emit('automation.error', { automationId });
  }

  /**
   * Reset error tracking
   */
  private async resetErrorTracking(automationId: string): Promise<void> {
    this.eventEmitter.emit('automation.success', { automationId });
  }
}
