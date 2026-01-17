import { Injectable, Logger } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import {
  AutomationRule,
  AuditLog,
  CollectionDefinition,
} from '@hubblewave/instance-db';
import {
  ActionExecutionResult,
  AutomationAction,
  ExecutionContext,
  RecordEventPayload,
  TriggerOperation,
} from './automation-runtime.types';
import { ConditionEvaluatorService } from './condition-evaluator.service';
import { ActionHandlerService } from './action-handler.service';
import { ScriptSandboxService } from './script-sandbox.service';
import { ExecutionLogService } from './execution-log.service';
import { RecordMutationService } from './record-mutation.service';
import { OutboxPublisherService } from './outbox-publisher.service';

const MAX_DEPTH = 5;
const MAX_AUTOMATIONS_PER_EVENT = 50;

@Injectable()
export class AutomationRuntimeService {
  private readonly logger = new Logger(AutomationRuntimeService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly conditionEvaluator: ConditionEvaluatorService,
    private readonly actionHandler: ActionHandlerService,
    private readonly scriptSandbox: ScriptSandboxService,
    private readonly executionLog: ExecutionLogService,
    private readonly recordMutation: RecordMutationService,
    private readonly outboxPublisher: OutboxPublisherService,
  ) {}

  async processRecordEvent(payload: RecordEventPayload): Promise<void> {
    const collection = await this.getCollection(payload.collectionCode);
    if (!collection) {
      this.logger.warn(`Automation skipped: collection ${payload.collectionCode} not found`);
      return;
    }

    const operation = this.mapEventType(payload.eventType);
    if (!operation) {
      return;
    }

    let record = payload.record;
    if (!record) {
      const fetched = await this.recordMutation.getRecordById(
        payload.collectionCode,
        payload.recordId
      );
      if (!fetched) {
        this.logger.warn(`Automation skipped: record ${payload.recordId} not found`);
        return;
      }
      record = fetched;
    }
    if (!record) {
      this.logger.warn(`Automation skipped: record ${payload.recordId} not found`);
      return;
    }

    const previousRecord = payload.previousRecord ?? null;
    const changes = payload.changedProperties ?? this.calculateChanges(record, previousRecord || {});

    const baseContext: ExecutionContext = {
      user: {
        id: payload.userId ?? null,
      },
      record: { ...record },
      previousRecord,
      changes,
      automation: null as unknown as ExecutionContext['automation'],
      depth: 1,
      maxDepth: MAX_DEPTH,
      executionChain: [],
      outputs: {},
      errors: [],
      warnings: [],
    };

    const automations = await this.getAutomationsForCollection(collection.id);
    let executedCount = 0;

    for (const automation of automations) {
      if (executedCount >= MAX_AUTOMATIONS_PER_EVENT) {
        this.logger.warn(`Automation limit reached for collection ${collection.code}`);
        break;
      }

      if (!this.isTimingCompatible(automation.triggerTiming)) {
        continue;
      }

      if (!this.isOperationCompatible(automation.triggerOperations, operation)) {
        continue;
      }

      if (
        operation === 'update' &&
        automation.watchProperties &&
        automation.watchProperties.length > 0 &&
        !automation.watchProperties.some((prop) => changes.includes(prop))
      ) {
        continue;
      }

      if (baseContext.executionChain.includes(automation.id)) {
        await this.executionLog.log({
          automationId: automation.id,
          automationName: automation.name,
          collectionId: automation.collectionId,
          recordId: payload.recordId,
          triggerEvent: operation,
          triggerTiming: automation.triggerTiming,
          status: 'skipped',
          skippedReason: 'Circular automation reference detected',
          triggeredBy: payload.userId ?? null,
          executionDepth: baseContext.depth,
        });
        continue;
      }

      baseContext.automation = {
        id: automation.id,
        name: automation.name,
        triggerTiming: automation.triggerTiming,
        abortOnError: automation.abortOnError,
      };
      baseContext.executionChain.push(automation.id);

      try {
        await this.executeAutomation(automation, baseContext, collection.code, operation);
        executedCount++;
        baseContext.executionChain.pop();
      } catch (error) {
        baseContext.executionChain.pop();
        this.logger.error(
          `Automation ${automation.id} failed: ${(error as Error).message}`,
        );
      }
    }
  }

  private async executeAutomation(
    automation: AutomationRule,
    context: ExecutionContext,
    collectionCode: string,
    operation: TriggerOperation,
  ): Promise<void> {
    const startTime = Date.now();
    const actionsExecuted: ActionExecutionResult[] = [];
    let modifiedRecord = { ...context.record };
    const errors: Array<{ property: string; message: string }> = [];
    const warnings: Array<{ property: string; message: string }> = [];

    if (automation.conditionType !== 'always') {
      const conditionResult = await this.evaluateCondition(automation, context);
      if (!conditionResult.result) {
        await this.executionLog.log({
          automationId: automation.id,
          automationName: automation.name,
          collectionId: automation.collectionId,
          recordId: context.record.id as string,
          triggerEvent: operation,
          triggerTiming: automation.triggerTiming,
          status: 'skipped',
          skippedReason: 'Condition not met',
          inputData: { condition: automation.condition, evaluation: conditionResult.trace },
          triggeredBy: context.user.id,
          executionDepth: context.depth,
          durationMs: Date.now() - startTime,
        });

        await this.writeAutomationAudit({
          userId: context.user.id,
          automationId: automation.id,
          automationName: automation.name,
          collectionCode,
          recordId: context.record.id as string,
          status: 'skipped',
          details: { reason: 'Condition not met' },
        });

        return;
      }
    }

    let aborted = false;
    let abortMessage: string | undefined;

    if (automation.actionType === 'no_code' && automation.actions) {
      for (const action of automation.actions as AutomationAction[]) {
        const actionStart = Date.now();

        if (action.condition) {
          const actionCondition = this.conditionEvaluator.evaluate(action.condition, {
            ...context,
            record: modifiedRecord,
          });
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
          const result = await this.actionHandler.execute(action, {
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

          if (result.type === 'modify_record') {
            if (operation === 'delete') {
              warnings.push({
                property: '_automation',
                message: 'Modify record action skipped on delete event',
              });
            } else {
              modifiedRecord = { ...modifiedRecord, ...result.changes };
            }
          } else if (result.type === 'create_record') {
            const output = result.output as { collection: string; values: Record<string, unknown> };
            await this.recordMutation.createRecord({
              collectionCode: output.collection,
              values: output.values,
              actorId: context.user.id,
            });
          } else if (result.type === 'send_notification') {
            await this.outboxPublisher.publishEvent({
              eventType: 'automation.notification.requested',
              payload: {
                automationId: automation.id,
                collectionCode,
                recordId: context.record.id,
                notification: result.output,
              },
            });
          } else if (result.type === 'start_workflow') {
            await this.outboxPublisher.publishEvent({
              eventType: 'automation.workflow.start',
              payload: {
                automationId: automation.id,
                collectionCode,
                recordId: context.record.id,
                workflow: result.output,
              },
            });
          } else if (result.type === 'abort') {
            aborted = true;
            abortMessage = result.message;
            break;
          } else if (result.type === 'add_error') {
            errors.push({ property: result.property || 'record', message: result.message || 'Error' });
          } else if (result.type === 'add_warning') {
            warnings.push({ property: result.property || 'record', message: result.message || 'Warning' });
          }
        } catch (error) {
          actionsExecuted.push({
            actionId: action.id,
            actionType: action.type,
            success: false,
            error: (error as Error).message,
            durationMs: Date.now() - actionStart,
          });

          if (!action.continueOnError && automation.abortOnError) {
            throw error;
          }
        }
      }
    } else if (automation.actionType === 'script' && automation.script) {
      const scriptResult = await this.scriptSandbox.execute(automation.script, context);
      if (scriptResult.changes && operation !== 'delete') {
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

    let persistedRecord: Record<string, unknown> | undefined;
    if (!aborted && operation !== 'delete' && this.hasRecordChanges(context.record, modifiedRecord)) {
      persistedRecord = await this.recordMutation.updateRecord({
        collectionCode,
        recordId: context.record.id as string,
        changes: this.diffRecord(context.record, modifiedRecord),
        actorId: context.user.id,
      });
    }

    const status = errors.length > 0 ? 'error' : 'success';
    await this.executionLog.log({
      automationId: automation.id,
      automationName: automation.name,
      collectionId: automation.collectionId,
      recordId: context.record.id as string,
      triggerEvent: operation,
      triggerTiming: automation.triggerTiming,
      status: aborted ? 'skipped' : status,
      skippedReason: aborted ? abortMessage : undefined,
      inputData: context.record,
      outputData: persistedRecord || modifiedRecord,
      actionsExecuted: actionsExecuted as unknown as Record<string, unknown>[],
      triggeredBy: context.user.id,
      executionDepth: context.depth,
      durationMs: Date.now() - startTime,
      errorMessage: errors[0]?.message,
    });

    await this.writeAutomationAudit({
      userId: context.user.id,
      automationId: automation.id,
      automationName: automation.name,
      collectionCode,
      recordId: context.record.id as string,
      status: aborted ? 'skipped' : status,
      details: {
        errors,
        warnings,
        aborted,
        abortMessage,
      },
    });

    if (errors.length > 0) {
      await this.recordAutomationError(automation.id);
    } else {
      await this.recordAutomationSuccess(automation.id);
    }
  }

  private async evaluateCondition(
    automation: AutomationRule,
    context: ExecutionContext,
  ): Promise<{ result: boolean; trace: Record<string, unknown> }> {
    if (automation.conditionType === 'condition') {
      if (!automation.condition) {
        return { result: true, trace: { conditionEmpty: true } };
      }
      const evalResult = this.conditionEvaluator.evaluate(
        automation.condition as unknown as any,
        context,
      );
      return { result: evalResult.result, trace: evalResult.trace as unknown as Record<string, unknown> };
    }
    if (automation.conditionType === 'script' && automation.conditionScript) {
      const result = await this.scriptSandbox.execute(automation.conditionScript, context);
      return { result: Boolean(result.output), trace: { scriptOutput: result.output } };
    }
    return { result: true, trace: {} };
  }

  private async getCollection(code: string): Promise<CollectionDefinition | null> {
    const repo = this.dataSource.getRepository(CollectionDefinition);
    return repo.findOne({ where: { code, isActive: true } });
  }

  private async getAutomationsForCollection(collectionId: string): Promise<AutomationRule[]> {
    const repo: Repository<AutomationRule> = this.dataSource.getRepository(AutomationRule);
    return repo.find({
      where: { collectionId, isActive: true },
      order: { executionOrder: 'ASC' },
    });
  }

  private mapEventType(eventType: string): TriggerOperation | null {
    switch (eventType) {
      case 'record.created':
        return 'insert';
      case 'record.updated':
        return 'update';
      case 'record.deleted':
        return 'delete';
      default:
        return null;
    }
  }

  private isTimingCompatible(triggerTiming: string): boolean {
    return triggerTiming === 'after' || triggerTiming === 'async';
  }

  private isOperationCompatible(
    operations: TriggerOperation[],
    operation: TriggerOperation,
  ): boolean {
    if (!operations || operations.length === 0) {
      return true;
    }
    return operations.includes(operation);
  }

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

  private hasRecordChanges(
    current: Record<string, unknown>,
    updated: Record<string, unknown>,
  ): boolean {
    return this.calculateChanges(updated, current).length > 0;
  }

  private diffRecord(
    current: Record<string, unknown>,
    updated: Record<string, unknown>,
  ): Record<string, unknown> {
    const diff: Record<string, unknown> = {};
    for (const key of Object.keys(updated)) {
      if (JSON.stringify(updated[key]) !== JSON.stringify(current[key])) {
        diff[key] = updated[key];
      }
    }
    return diff;
  }

  private async recordAutomationSuccess(automationId: string): Promise<void> {
    const repo = this.dataSource.getRepository(AutomationRule);
    await repo.update(automationId, {
      consecutiveErrors: 0,
      lastExecutedAt: new Date(),
    });
  }

  private async recordAutomationError(automationId: string): Promise<void> {
    const repo = this.dataSource.getRepository(AutomationRule);
    await repo.increment({ id: automationId }, 'consecutiveErrors', 1);
    await repo.update(automationId, { lastExecutedAt: new Date() });
    const automation = await repo.findOne({ where: { id: automationId } });
    if (automation && automation.consecutiveErrors >= 5) {
      await repo.update(automationId, { isActive: false });
      this.logger.warn(`Automation '${automation.name}' disabled due to consecutive errors`);
    }
  }

  private async writeAutomationAudit(params: {
    userId: string | null;
    automationId: string;
    automationName: string;
    collectionCode: string;
    recordId: string;
    status: string;
    details?: Record<string, unknown>;
  }): Promise<void> {
    const repo = this.dataSource.getRepository(AuditLog);
    const entry = repo.create({
      userId: params.userId ?? null,
      collectionCode: 'automation_rule',
      recordId: params.automationId,
      action: 'automation.execute',
      newValues: {
        automationName: params.automationName,
        status: params.status,
        targetCollection: params.collectionCode,
        targetRecordId: params.recordId,
        details: params.details || {},
      },
    });
    await repo.save(entry);
  }
}
