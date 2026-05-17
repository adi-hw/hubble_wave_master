import { Injectable, Logger } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import {
  AutomationRule,
  CollectionDefinition,
  PropertyDefinition,
  withAudit,
  AuditRecorder,
  RuntimeAnomalyService,
} from '@hubblewave/instance-db';
import { AuthorizationService } from '@hubblewave/authorization';
import { UserRequestContext } from '@hubblewave/auth-guard';
import {
  ActionExecutionResult,
  AutomationAction,
  AutomationExecutionStatus,
  ExecuteSyncTriggerArgs,
  ExecutionContext,
  RecordEventPayload,
  SyncQueuedAction,
  SyncTriggerResult,
  TriggerOperation,
  TriggeredByPrincipalType,
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
    private readonly authz: AuthorizationService,
    private readonly runtimeAnomaly: RuntimeAnomalyService,
  ) {}

  async processRecordEvent(payload: RecordEventPayload): Promise<void> {
    const collection = await this.getCollection(payload.collectionCode);
    if (!collection) {
      this.logger.warn(`Automation skipped: collection ${payload.collectionCode} not found`);
      await this.runtimeAnomaly.record({
        kind: 'record_lookup_missing',
        serviceCode: 'svc-automation',
        message: `Automation skipped: collection ${payload.collectionCode} not found`,
        collectionCode: payload.collectionCode,
        recordId: payload.recordId,
        context: { eventType: payload.eventType, missing: 'collection' },
      });
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
        await this.runtimeAnomaly.record({
          kind: 'record_lookup_missing',
          serviceCode: 'svc-automation',
          message: `Automation skipped: record ${payload.recordId} not found in ${payload.collectionCode}`,
          collectionCode: payload.collectionCode,
          recordId: payload.recordId,
          context: { eventType: payload.eventType, missing: 'record' },
        });
        return;
      }
      record = fetched;
    }
    if (!record) {
      this.logger.warn(`Automation skipped: record ${payload.recordId} not found`);
      await this.runtimeAnomaly.record({
        kind: 'record_lookup_missing',
        serviceCode: 'svc-automation',
        message: `Automation skipped: record ${payload.recordId} not found in ${payload.collectionCode}`,
        collectionCode: payload.collectionCode,
        recordId: payload.recordId,
        context: { eventType: payload.eventType, missing: 'record' },
      });
      return;
    }

    const previousRecord = payload.previousRecord ?? null;
    const changes = payload.changedProperties ?? this.calculateChanges(record, previousRecord || {});

    const authorizedFields = await this.computeAuthorizedFields(
      collection.tableName,
      payload.userId ?? null,
    );

    // Reconstruct chain/depth state from the inbound event. Outbox events
    // emitted by an automation chain carry these fields; user-originated
    // events do not, so they default to an empty chain at depth=1.
    const inboundChain = new Set<string>(payload.executionChain ?? []);
    const inboundDepth = Math.max(1, payload.executionDepth ?? 1);

    const principalType = this.resolvePrincipalType(payload);

    // Depth gate: a chain that already reached MAX_DEPTH must not produce
    // another generation. Record a structured 'skipped' execution log so
    // operators can alert on truncated chains rather than silently dropping.
    if (inboundDepth > MAX_DEPTH) {
      this.logger.warn(
        `Automation execution depth exceeded MAX_DEPTH=${MAX_DEPTH}, dropping chain ` +
          `(collection=${collection.code} record=${payload.recordId} depth=${inboundDepth})`,
      );
      await withAudit(this.dataSource, async (mgr) => {
        await this.executionLog.log(
          {
            automationName: '_chain_depth_exceeded',
            collectionId: collection.id,
            recordId: payload.recordId,
            triggerEvent: operation,
            status: 'skipped',
            skippedReason: `Automation chain depth exceeded MAX_DEPTH=${MAX_DEPTH}`,
            triggeredBy: payload.userId ?? null,
            triggeredByPrincipalType: principalType,
            executionDepth: inboundDepth,
          },
          mgr,
        );
      });
      return;
    }

    const baseContext: ExecutionContext = {
      user: {
        id: payload.userId ?? null,
      },
      record: { ...record },
      previousRecord,
      changes,
      automation: null as unknown as ExecutionContext['automation'],
      depth: inboundDepth,
      maxDepth: MAX_DEPTH,
      executionChain: inboundChain,
      outputs: {},
      errors: [],
      warnings: [],
      authorizedFields,
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

      // Cycle key: `${automationId}:${recordId}`. Including the record id
      // means the same automation is allowed to fire on a different record
      // (legitimate cross-record fan-out — e.g. A on rec-1 → A on rec-2)
      // while same (automation, record) re-entry inside one chain is
      // detected as a cycle.
      const cycleKey = `${automation.id}:${payload.recordId}`;
      if (baseContext.executionChain.has(cycleKey)) {
        await withAudit(this.dataSource, async (mgr, recordAudit) => {
          await this.executionLog.log(
            {
              automationId: automation.id,
              automationName: automation.name,
              collectionId: automation.collectionId,
              recordId: payload.recordId,
              triggerEvent: operation,
              triggerTiming: automation.triggerTiming,
              status: 'skipped',
              skippedReason: 'Circular automation reference detected',
              triggeredBy: payload.userId ?? null,
              triggeredByPrincipalType: principalType,
              executionDepth: baseContext.depth,
            },
            mgr,
          );

          this.recordAutomationAudit(recordAudit, {
            userId: payload.userId ?? null,
            automationId: automation.id,
            automationName: automation.name,
            collectionCode: collection.code,
            recordId: payload.recordId,
            status: 'skipped',
            details: { reason: 'Circular automation reference detected' },
          });
        });
        continue;
      }

      baseContext.automation = {
        id: automation.id,
        name: automation.name,
        triggerTiming: automation.triggerTiming,
        abortOnError: automation.abortOnError,
      };
      baseContext.executionChain.add(cycleKey);

      try {
        await this.executeAutomation(automation, baseContext, collection.code, operation, principalType);
        executedCount++;
        baseContext.executionChain.delete(cycleKey);
      } catch (error) {
        baseContext.executionChain.delete(cycleKey);
        this.logger.error(
          `Automation ${automation.id} failed: ${(error as Error).message}`,
        );
        // Loud, queryable record of the swallowed after-automation failure.
        // The original logger output is preserved above; the anomaly is
        // additive observability so operators can alert on spikes rather
        // than relying on log scraping.
        await this.runtimeAnomaly.record({
          kind: 'after_automation_swallowed',
          serviceCode: 'svc-automation',
          message: `Automation ${automation.id} (${automation.name}) failed during ${operation} of ${collection.code}/${payload.recordId}: ${(error as Error).message}`,
          collectionCode: collection.code,
          recordId: payload.recordId,
          context: {
            automationId: automation.id,
            automationName: automation.name,
            operation,
            executionDepth: baseContext.depth,
            triggerTiming: automation.triggerTiming,
          },
          error: error as Error,
        });
      }
    }
  }

  /**
   * Synchronous (in-request) automation execution path. Used by other
   * instance services that need before-trigger semantics — the caller
   * still holds the user's request open, and the result of this method
   * decides whether the caller commits, what record they commit, and
   * what post-commit side-effects they enqueue.
   *
   * Differs from {@link processRecordEvent} (the async/outbox path) in
   * three load-bearing ways:
   *  1. Never persists modifications. The caller owns the commit; this
   *     method returns `modifiedRecord` for the caller to apply.
   *  2. Never emits outbox events directly. Side-effects (create_record,
   *     send_notification, fire_event, start_workflow) are returned in
   *     `asyncQueue` for the caller to enqueue after its own commit.
   *     A `before`-trigger that aborts must NOT have published a
   *     notification — queueing protects that invariant.
   *  3. Returns structured `SyncTriggerResult` including an explicit
   *     `aborted` flag the caller MUST honor by rejecting its write.
   *
   * Internal duplication with {@link processRecordEvent} / {@link executeAutomation}
   * is intentional in this PR — the post-deletion refactor (after svc-data's
   * local executor is removed in PR 4) extracts the shared loop into a
   * primitive both callers use. Doing that refactor now would violate
   * Plan Fix 1's "small reversible PR" property.
   */
  async executeSyncTrigger(args: ExecuteSyncTriggerArgs): Promise<SyncTriggerResult> {
    const collection = await this.getCollectionById(args.collectionId);
    if (!collection) {
      this.logger.warn(`Sync trigger skipped: collection ${args.collectionId} not found`);
      const recordId = args.record.id as string | undefined;
      await this.runtimeAnomaly.record({
        kind: 'record_lookup_missing',
        serviceCode: 'svc-automation',
        message: `Sync trigger skipped: collection ${args.collectionId} not found`,
        recordId,
        context: {
          collectionId: args.collectionId,
          timing: args.timing,
          operation: args.operation,
          missing: 'collection',
        },
      });
      return this.emptySyncResult(args.record);
    }

    const previousRecord = args.previousRecord ?? null;
    const changes = previousRecord
      ? this.calculateChanges(args.record, previousRecord)
      : [];
    const inboundDepth = (args.parentContext?.depth ?? 0) + 1;
    const inboundChain = new Set<string>(args.parentContext?.executionChain ?? []);
    const principalType: TriggeredByPrincipalType = args.userContext.id ? 'user' : 'service';

    let modifiedRecord: Record<string, unknown> = { ...args.record };
    const errors: Array<{ property: string; message: string }> = [];
    const warnings: Array<{ property: string; message: string }> = [];
    const asyncQueue: SyncQueuedAction[] = [];
    let aborted = false;
    let abortMessage: string | undefined;

    if (inboundDepth > MAX_DEPTH) {
      this.logger.warn(
        `Sync trigger depth exceeded MAX_DEPTH=${MAX_DEPTH}, dropping chain ` +
          `(collection=${collection.code} depth=${inboundDepth})`,
      );
      await withAudit(this.dataSource, async (mgr) => {
        await this.executionLog.log(
          {
            automationName: '_chain_depth_exceeded',
            collectionId: collection.id,
            recordId: (args.record.id as string) ?? '_pending',
            triggerEvent: args.operation,
            triggerTiming: args.timing,
            status: 'skipped',
            skippedReason: `Automation chain depth exceeded MAX_DEPTH=${MAX_DEPTH}`,
            triggeredBy: args.userContext.id ?? null,
            triggeredByPrincipalType: principalType,
            executionDepth: inboundDepth,
          },
          mgr,
        );
      });
      warnings.push({
        property: '_automation',
        message: `Automation chain depth exceeded MAX_DEPTH=${MAX_DEPTH}`,
      });
      return { modifiedRecord, errors, warnings, asyncQueue, aborted: false };
    }

    const authorizedFields = await this.computeAuthorizedFields(
      collection.tableName,
      args.userContext.id ?? null,
    );

    const automations = await this.getAutomationsForCollection(collection.id);
    let executedCount = 0;

    for (const automation of automations) {
      if (aborted) break;
      if (executedCount >= MAX_AUTOMATIONS_PER_EVENT) {
        this.logger.warn(
          `Sync trigger automation limit reached for collection ${collection.code}`,
        );
        await this.runtimeAnomaly.record({
          kind: 'sync_trigger_automation_limit_reached',
          serviceCode: 'svc-automation',
          message: `Sync trigger automation limit (${MAX_AUTOMATIONS_PER_EVENT}) reached for collection ${collection.code}; remaining automations skipped`,
          collectionCode: collection.code,
          context: { collectionId: args.collectionId, operation: args.operation, timing: args.timing, executedCount },
        });
        break;
      }

      if (automation.triggerTiming !== args.timing) continue;
      if (!this.isOperationCompatible(automation.triggerOperations, args.operation)) continue;

      if (
        args.operation === 'update' &&
        automation.watchProperties &&
        automation.watchProperties.length > 0 &&
        !automation.watchProperties.some((prop) => changes.includes(prop))
      ) {
        continue;
      }

      const recordIdForCycle = (args.record.id as string) ?? '_pending';
      const cycleKey = `${automation.id}:${recordIdForCycle}`;
      if (inboundChain.has(cycleKey)) {
        await withAudit(this.dataSource, async (mgr, recordAudit) => {
          await this.executionLog.log(
            {
              automationId: automation.id,
              automationName: automation.name,
              collectionId: automation.collectionId,
              recordId: recordIdForCycle,
              triggerEvent: args.operation,
              triggerTiming: automation.triggerTiming,
              status: 'skipped',
              skippedReason: 'Circular automation reference detected',
              triggeredBy: args.userContext.id ?? null,
              triggeredByPrincipalType: principalType,
              executionDepth: inboundDepth,
            },
            mgr,
          );
          this.recordAutomationAudit(recordAudit, {
            userId: args.userContext.id ?? null,
            automationId: automation.id,
            automationName: automation.name,
            collectionCode: collection.code,
            recordId: recordIdForCycle,
            status: 'skipped',
            principalType,
            details: { reason: 'Circular automation reference detected' },
          });
        });
        continue;
      }

      const ctx: ExecutionContext = {
        user: { id: args.userContext.id ?? null, email: args.userContext.email, roles: args.userContext.roles },
        record: modifiedRecord,
        previousRecord,
        changes,
        automation: {
          id: automation.id,
          name: automation.name,
          triggerTiming: automation.triggerTiming,
          abortOnError: automation.abortOnError,
        },
        depth: inboundDepth,
        maxDepth: MAX_DEPTH,
        executionChain: new Set(inboundChain),
        outputs: {},
        errors: [],
        warnings: [],
        authorizedFields,
      };

      // Condition gate
      if (automation.conditionType !== 'always') {
        const conditionResult = await this.evaluateCondition(automation, ctx);
        if (!conditionResult.result) {
          await withAudit(this.dataSource, async (mgr, recordAudit) => {
            await this.executionLog.log(
              {
                automationId: automation.id,
                automationName: automation.name,
                collectionId: automation.collectionId,
                recordId: recordIdForCycle,
                triggerEvent: args.operation,
                triggerTiming: automation.triggerTiming,
                status: 'skipped',
                skippedReason: 'Condition not met',
                inputData: { condition: automation.condition, evaluation: conditionResult.trace },
                triggeredBy: args.userContext.id ?? null,
                triggeredByPrincipalType: principalType,
                executionDepth: inboundDepth,
              },
              mgr,
            );
            this.recordAutomationAudit(recordAudit, {
              userId: args.userContext.id ?? null,
              automationId: automation.id,
              automationName: automation.name,
              collectionCode: collection.code,
              recordId: recordIdForCycle,
              status: 'skipped',
              principalType,
              details: { reason: 'Condition not met' },
            });
          });
          continue;
        }
      }

      // Action execution
      inboundChain.add(cycleKey);
      const startTime = Date.now();
      const actionsExecuted: ActionExecutionResult[] = [];
      let actionFailureCount = 0;
      const localErrors: Array<{ property: string; message: string }> = [];
      const localWarnings: Array<{ property: string; message: string }> = [];

      try {
        if (automation.actionType === 'no_code' && automation.actions) {
          for (const action of automation.actions as AutomationAction[]) {
            if (aborted) break;
            const actionStart = Date.now();

            if (action.condition) {
              const cond = this.conditionEvaluator.evaluate(action.condition, {
                ...ctx,
                record: modifiedRecord,
              });
              if (!cond.result) {
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
                ...ctx,
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
                if (args.operation === 'delete') {
                  localWarnings.push({
                    property: '_automation',
                    message: 'Modify record action skipped on delete event',
                  });
                } else {
                  modifiedRecord = { ...modifiedRecord, ...result.changes };
                }
              } else if (
                result.type === 'create_record' ||
                result.type === 'send_notification' ||
                result.type === 'start_workflow' ||
                result.type === 'fire_event'
              ) {
                // Sync path: queue for caller's post-commit drain.
                // executeAfterCommit is true for `before` triggers (caller
                // hasn't committed yet) and false for `after` triggers
                // (caller already committed when sync trigger ran).
                asyncQueue.push({
                  action: { id: action.id, type: action.type, config: action.config },
                  executeAsync: true,
                  executeAfterCommit: args.timing === 'before',
                  output: result.output,
                });
              } else if (result.type === 'abort') {
                aborted = true;
                abortMessage = result.message;
                break;
              } else if (result.type === 'add_error') {
                localErrors.push({
                  property: result.property || 'record',
                  message: result.message || 'Error',
                });
              } else if (result.type === 'add_warning') {
                localWarnings.push({
                  property: result.property || 'record',
                  message: result.message || 'Warning',
                });
              }
            } catch (error) {
              actionFailureCount++;
              actionsExecuted.push({
                actionId: action.id,
                actionType: action.type,
                success: false,
                error: (error as Error).message,
                durationMs: Date.now() - actionStart,
              });

              if (!action.continueOnError && automation.abortOnError) {
                localErrors.push({
                  property: '_automation',
                  message: `Action ${action.type} failed: ${(error as Error).message}`,
                });
                break;
              }
            }
          }
        } else if (automation.actionType === 'script' && automation.script) {
          const scriptStart = Date.now();
          try {
            const scriptResult = await this.scriptSandbox.execute(automation.script, ctx, {
              mode: 'transformation',
            });
            if (scriptResult.changes && args.operation !== 'delete') {
              modifiedRecord = { ...modifiedRecord, ...scriptResult.changes };
            }
            actionsExecuted.push({
              actionId: 'script',
              actionType: 'run_script',
              success: true,
              output: scriptResult.output,
              durationMs: scriptResult.durationMs,
            });
          } catch (error) {
            const message = (error as Error).message;
            actionsExecuted.push({
              actionId: 'script',
              actionType: 'run_script',
              success: false,
              error: message,
              durationMs: Date.now() - scriptStart,
            });
            localErrors.push({ property: '_script', message });
          }
        }
      } finally {
        inboundChain.delete(cycleKey);
      }

      let status: AutomationExecutionStatus;
      if (localErrors.length > 0 && actionsExecuted.some((a) => a.success)) {
        status = 'partial_failure';
      } else if (localErrors.length > 0 || actionFailureCount > 0) {
        status = actionsExecuted.some((a) => a.success) ? 'partial_failure' : 'error';
      } else {
        status = 'success';
      }

      await withAudit(this.dataSource, async (mgr, recordAudit) => {
        await this.executionLog.log(
          {
            automationId: automation.id,
            automationName: automation.name,
            collectionId: automation.collectionId,
            recordId: recordIdForCycle,
            triggerEvent: args.operation,
            triggerTiming: automation.triggerTiming,
            status: aborted ? 'skipped' : status,
            skippedReason: aborted ? abortMessage : undefined,
            inputData: ctx.record,
            outputData: modifiedRecord,
            actionsExecuted: actionsExecuted as unknown as Record<string, unknown>[],
            triggeredBy: args.userContext.id ?? null,
            triggeredByPrincipalType: principalType,
            executionDepth: inboundDepth,
            durationMs: Date.now() - startTime,
            errorMessage: localErrors[0]?.message,
          },
          mgr,
        );
        this.recordAutomationAudit(recordAudit, {
          userId: args.userContext.id ?? null,
          automationId: automation.id,
          automationName: automation.name,
          collectionCode: collection.code,
          recordId: recordIdForCycle,
          status: aborted ? 'skipped' : status,
          principalType,
          details: { errors: localErrors, warnings: localWarnings, aborted, abortMessage },
        });
      });

      if (localErrors.length > 0) {
        await this.recordAutomationError(automation.id);
      } else {
        await this.recordAutomationSuccess(automation.id);
      }

      errors.push(...localErrors);
      warnings.push(...localWarnings);
      executedCount++;
    }

    const result: SyncTriggerResult = {
      modifiedRecord,
      errors,
      warnings,
      asyncQueue,
      aborted,
    };
    if (abortMessage !== undefined) {
      result.abortMessage = abortMessage;
    }
    return result;
  }

  private async getCollectionById(id: string): Promise<CollectionDefinition | null> {
    const repo = this.dataSource.getRepository(CollectionDefinition);
    return repo.findOne({ where: { id, isActive: true } });
  }

  private emptySyncResult(record: Record<string, unknown>): SyncTriggerResult {
    return {
      modifiedRecord: { ...record },
      errors: [],
      warnings: [],
      asyncQueue: [],
      aborted: false,
    };
  }

  private async executeAutomation(
    automation: AutomationRule,
    context: ExecutionContext,
    collectionCode: string,
    operation: TriggerOperation,
    principalType: TriggeredByPrincipalType,
  ): Promise<void> {
    const startTime = Date.now();
    const actionsExecuted: ActionExecutionResult[] = [];
    let modifiedRecord = { ...context.record };
    const errors: Array<{ property: string; message: string }> = [];
    const warnings: Array<{ property: string; message: string }> = [];
    let actionFailureCount = 0;

    if (automation.conditionType !== 'always') {
      const conditionResult = await this.evaluateCondition(automation, context);
      if (!conditionResult.result) {
        await withAudit(this.dataSource, async (mgr, recordAudit) => {
          await this.executionLog.log(
            {
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
              triggeredByPrincipalType: principalType,
              executionDepth: context.depth,
              durationMs: Date.now() - startTime,
            },
            mgr,
          );

          this.recordAutomationAudit(recordAudit, {
            userId: context.user.id,
            automationId: automation.id,
            automationName: automation.name,
            collectionCode,
            recordId: context.record.id as string,
            status: 'skipped',
            principalType,
            details: { reason: 'Condition not met' },
          });
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
            // Forward chain + depth onto the outbox event the mutation
            // emits so the next runtime invocation can detect cycles and
            // honour MAX_DEPTH across the chain.
            await this.recordMutation.createRecord({
              collectionCode: output.collection,
              values: output.values,
              actorId: context.user.id,
              executionChain: Array.from(context.executionChain),
              executionDepth: context.depth + 1,
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
          } else if (result.type === 'fire_event') {
            // FireEvent / log_event — publishes a custom event onto
            // the platform event bus so downstream consumers (other
            // automations, integrations, audit) can react. The
            // event name is operator-supplied; we wrap it under the
            // automation.* namespace at the outbox boundary so the
            // origin is unambiguous.
            const fired = result.output as { event?: string; data?: Record<string, unknown> };
            const eventName = (fired?.event ?? '').trim();
            if (!eventName) {
              warnings.push({
                property: 'event',
                message: 'FireEvent action requires a non-empty event name',
              });
            } else {
              await this.outboxPublisher.publishEvent({
                eventType: `automation.event.${eventName}`,
                payload: {
                  automationId: automation.id,
                  collectionCode,
                  recordId: context.record.id,
                  event: eventName,
                  data: fired?.data ?? {},
                },
              });
            }
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
          actionFailureCount++;
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
      const scriptStart = Date.now();
      try {
        const scriptResult = await this.scriptSandbox.execute(automation.script, context, {
          mode: 'transformation',
        });
        if (scriptResult.changes && operation !== 'delete') {
          modifiedRecord = { ...modifiedRecord, ...scriptResult.changes };
        }
        actionsExecuted.push({
          actionId: 'script',
          actionType: 'run_script',
          success: true,
          output: scriptResult.output,
          durationMs: scriptResult.durationMs,
        });
      } catch (error) {
        // Transformation script failures must not be silently swallowed.
        // Record the failure as an error so the automation status reflects it.
        const message = (error as Error).message;
        actionsExecuted.push({
          actionId: 'script',
          actionType: 'run_script',
          success: false,
          error: message,
          durationMs: Date.now() - scriptStart,
        });
        errors.push({ property: '_script', message });
      }
    }

    // 'success' is reserved for executions where every action ran without
    // error. If any action failed but the automation continued (because the
    // failing action set continueOnError), we report 'partial_failure' to
    // make the partial outcome visible to the audit log and downstream
    // consumers — silent success would mask real failures.
    let status: AutomationExecutionStatus;
    if (errors.length > 0 && actionsExecuted.some((a) => a.success)) {
      status = 'partial_failure';
    } else if (errors.length > 0 || actionFailureCount > 0) {
      status = actionsExecuted.some((a) => a.success) ? 'partial_failure' : 'error';
    } else {
      status = 'success';
    }

    await withAudit(this.dataSource, async (mgr, recordAudit) => {
      let persistedRecord: Record<string, unknown> | undefined;
      if (
        !aborted &&
        operation !== 'delete' &&
        this.hasRecordChanges(context.record, modifiedRecord)
      ) {
        // Forward chain + depth onto the outbox event the mutation emits so
        // the next runtime invocation can detect cycles and honour MAX_DEPTH
        // across the chain. Without this, A→B→A cycles on the same record
        // and chains deeper than MAX_DEPTH escape detection.
        persistedRecord = await this.recordMutation.updateRecordInTransaction(
          {
            collectionCode,
            recordId: context.record.id as string,
            changes: this.diffRecord(context.record, modifiedRecord),
            actorId: context.user.id,
            executionChain: Array.from(context.executionChain),
            executionDepth: context.depth + 1,
          },
          mgr,
          recordAudit,
        );
      }

      await this.executionLog.log(
        {
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
        },
        mgr,
      );

      this.recordAutomationAudit(recordAudit, {
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
      // Condition scripts run in fail-closed mode — a thrown or invalid script
      // is treated as 'condition not met' (output=false) by the sandbox.
      const result = await this.scriptSandbox.execute(automation.conditionScript, context, {
        mode: 'condition',
      });
      return { result: Boolean(result.output), trace: { scriptOutput: result.output, scriptError: result.error } };
    }
    return { result: true, trace: {} };
  }

  private async getCollection(code: string): Promise<CollectionDefinition | null> {
    const repo = this.dataSource.getRepository(CollectionDefinition);
    return repo.findOne({ where: { code, isActive: true } });
  }

  private async computeAuthorizedFields(
    tableName: string,
    userId: string | null,
  ): Promise<Set<string>> {
    // Build the request context for the actor; null userId implies a
    // system-driven event (schedule, integration), which receives full
    // visibility. Human-triggered events are filtered through the
    // authorization service so condition evaluators never read fields the
    // actor cannot legitimately see.
    const ctx: UserRequestContext = {
      kind: 'user',
      userId: userId ?? '00000000-0000-0000-0000-000000000000',
      roleIds: [],
      roleCodes: [],
      permissionCodes: [],
      groupIds: [],
      isAdmin: !userId,
      securityStamp: '',
    };
    const propertyRepo = this.dataSource.getRepository(PropertyDefinition);
    const properties = await propertyRepo
      .createQueryBuilder('property')
      .innerJoin('collection_definitions', 'collection', 'collection.id = property.collection_id')
      .where('collection.table_name = :tableName', { tableName })
      .andWhere('property.is_active = true')
      .getMany();
    const meta = properties.map((p) => ({
      code: p.code,
      label: p.name,
      isSystem: p.isSystem,
      storagePath: `column:${p.columnName || p.code}`,
    }));
    const authorized = await this.authz.getAuthorizedFields(ctx, tableName, meta);
    return new Set(authorized.filter((f) => f.canRead).map((f) => f.code));
  }

  private resolvePrincipalType(payload: RecordEventPayload): TriggeredByPrincipalType {
    // Distinguish trigger sources so audit/log consumers can attribute
    // automation effects accurately. Metadata is set by the publisher
    // (e.g. scheduler emits triggeredBy='schedule').
    const declared = (payload.metadata?.triggeredByPrincipalType ?? '') as string;
    if (declared === 'user' || declared === 'service' || declared === 'schedule' || declared === 'integration') {
      return declared;
    }
    if (!payload.userId) return 'service';
    return 'user';
  }

  private async getAutomationsForCollection(collectionId: string): Promise<AutomationRule[]> {
    // Tenancy invariant: this DataSource is the instance database injected by
    // AutomationRuntimeModule (which is itself only mounted in the
    // per-instance AppModule). Each customer instance runs its own service
    // process with its own DataSource, so there is no shared connection that
    // could leak rules between customers. The query intentionally has no
    // tenant filter — the connection itself enforces the boundary.
    //
    // Lifecycle gate (Phase 4 §9.1 / mirrors Phase 3.4 ProcessFlow): the
    // runtime requires status='published' AND isActive=true. svc-data
    // creates new rules at status='draft' but isActive=true by default,
    // so without the published predicate a draft rule would fire on
    // the next outbox event before its author published it.
    const repo: Repository<AutomationRule> = this.dataSource.getRepository(AutomationRule);
    return repo.find({
      where: { collectionId, isActive: true, status: 'published' },
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

  private recordAutomationAudit(
    recordAudit: AuditRecorder,
    params: {
      userId: string | null;
      automationId: string;
      automationName: string;
      collectionCode: string;
      recordId: string;
      status: string;
      principalType?: TriggeredByPrincipalType;
      details?: Record<string, unknown>;
    },
  ): void {
    recordAudit({
      userId: params.userId,
      collectionCode: 'automation_rule',
      recordId: params.automationId,
      action: 'automation.execute',
      newValues: {
        automationName: params.automationName,
        status: params.status,
        triggeredByPrincipalType: params.principalType,
        targetCollection: params.collectionCode,
        targetRecordId: params.recordId,
        details: params.details || {},
      },
    });
  }
}
