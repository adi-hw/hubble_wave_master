import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  AutomationRule,
  AuditLog,
  CollectionDefinition,
  PropertyDefinition,
  RuntimeAnomalyService,
} from '@hubblewave/instance-db';
import { AuthorizationService } from '@hubblewave/authorization';
import { AutomationRuntimeService } from '../../../../api/src/app/automation/runtime/automation-runtime.service';
import { ConditionEvaluatorService } from '../../../../api/src/app/automation/runtime/condition-evaluator.service';
import { ActionHandlerService } from '../../../../api/src/app/automation/runtime/action-handler.service';
import { ScriptSandboxService } from '../../../../api/src/app/automation/runtime/script-sandbox.service';
import { ExecutionLogService } from '../../../../api/src/app/automation/runtime/execution-log.service';
import { RecordMutationService } from '../../../../api/src/app/automation/runtime/record-mutation.service';
import { OutboxPublisherService } from '../../../../api/src/app/automation/runtime/outbox-publisher.service';
import {
  ExecuteSyncTriggerArgs,
  SyncTriggerResult,
} from '../../../../api/src/app/automation/runtime/automation-runtime.types';

/**
 * Cross-service contract test for executeSyncTrigger().
 *
 * This test fixes the wire-level behavior of svc-automation's sync
 * trigger path against a table of representative inputs. Each case is
 * shaped (input, action-handler-result, expected-result-shape) — input
 * is what the caller sends, action-handler-result is what the action
 * dispatcher returns when invoked, expected-result-shape is what
 * executeSyncTrigger() must return back to the caller.
 *
 * If a case here fails, the cross-service contract has changed. That
 * is sometimes intentional (a feature addition) and sometimes a
 * regression (a refactor accidentally moved a field). When intentional,
 * update the expected shape AND update PR 2's shadow comparator AND
 * update svc-data's call-sites in the same change. The whole point of
 * having the test here is so that the change is loud.
 *
 * Refs Plan Fix 1, PR 1 verification — establishes contract baseline at
 * endpoint creation rather than waiting for shadow mode in PR 3.
 */
describe('executeSyncTrigger contract', () => {
  let service: AutomationRuntimeService;
  let actionHandler: { execute: jest.Mock };
  let conditionEvaluator: { evaluate: jest.Mock; evaluateQuick: jest.Mock };
  let executionLog: { log: jest.Mock };
  let scriptSandbox: { execute: jest.Mock; evaluateCondition: jest.Mock };
  let collectionRepo: { findOne: jest.Mock };
  let runtimeAnomaly: { record: jest.Mock };
  let automationsForCollection: Array<Partial<AutomationRule>>;
  let warnSpy: jest.SpyInstance;

  beforeEach(async () => {
    automationsForCollection = [];

    collectionRepo = {
      findOne: jest.fn().mockResolvedValue({
        id: 'coll-1',
        code: 'work_order',
        tableName: 'work_orders',
        isActive: true,
      }),
    };

    const propertyRepoQB = {
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };
    const propertyRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(propertyRepoQB),
    };

    const automationRepo = {
      find: jest.fn(async () => automationsForCollection as AutomationRule[]),
      findOne: jest.fn().mockResolvedValue({ consecutiveErrors: 0 }),
      update: jest.fn().mockResolvedValue(undefined),
      increment: jest.fn().mockResolvedValue(undefined),
    };

    const auditLogRepo = {
      create: jest.fn((entry) => entry),
      save: jest.fn().mockResolvedValue(undefined),
    };

    const repoFor = (entity: unknown) => {
      if (entity === CollectionDefinition) return collectionRepo;
      if (entity === PropertyDefinition) return propertyRepo;
      if (entity === AutomationRule) return automationRepo;
      if (entity === AuditLog) return auditLogRepo;
      return {
        create: (e: unknown) => e,
        save: jest.fn().mockResolvedValue(undefined),
        findOne: jest.fn(),
        find: jest.fn(),
      };
    };
    const dataSource = {
      getRepository: jest.fn(repoFor),
      transaction: jest.fn(async <T>(fn: (m: unknown) => Promise<T>): Promise<T> => {
        const mgr = { getRepository: jest.fn(repoFor) };
        return fn(mgr);
      }),
    } as unknown as DataSource;

    conditionEvaluator = {
      evaluate: jest.fn().mockReturnValue({
        result: true,
        summary: '',
        trace: { type: 'single', result: true },
        durationMs: 0,
      }),
      evaluateQuick: jest.fn().mockReturnValue(true),
    };

    actionHandler = {
      execute: jest.fn().mockResolvedValue({ type: 'none', output: 'ok' }),
    };

    scriptSandbox = {
      execute: jest.fn().mockResolvedValue({ output: true, durationMs: 1 }),
      evaluateCondition: jest.fn().mockResolvedValue(true),
    };

    executionLog = { log: jest.fn().mockResolvedValue(undefined) };

    const recordMutation = {
      getRecordById: jest.fn().mockResolvedValue(null),
      createRecord: jest.fn().mockResolvedValue({ id: 'created-1' }),
      updateRecord: jest.fn().mockResolvedValue({ id: 'rec-1' }),
    };

    const outboxPublisher = {
      publishEvent: jest.fn().mockResolvedValue(undefined),
      publishRecordEvent: jest.fn().mockResolvedValue(undefined),
    };

    const authz = {
      getAuthorizedFields: jest.fn(async () => []),
    };

    runtimeAnomaly = {
      record: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AutomationRuntimeService,
        { provide: DataSource, useValue: dataSource },
        { provide: ConditionEvaluatorService, useValue: conditionEvaluator },
        { provide: ActionHandlerService, useValue: actionHandler },
        { provide: ScriptSandboxService, useValue: scriptSandbox },
        { provide: ExecutionLogService, useValue: executionLog },
        { provide: RecordMutationService, useValue: recordMutation },
        { provide: OutboxPublisherService, useValue: outboxPublisher },
        { provide: AuthorizationService, useValue: authz },
        { provide: RuntimeAnomalyService, useValue: runtimeAnomaly },
      ],
    }).compile();

    service = module.get<AutomationRuntimeService>(AutomationRuntimeService);
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    warnSpy.mockRestore();
    jest.clearAllMocks();
  });

  // ==========================================================================
  // Helpers
  // ==========================================================================

  const automation = (overrides: Partial<AutomationRule> = {}): Partial<AutomationRule> => ({
    id: 'auto-1',
    name: 'Test automation',
    collectionId: 'coll-1',
    triggerTiming: 'before',
    triggerOperations: ['insert', 'update'],
    conditionType: 'always',
    actionType: 'no_code',
    actions: [{ id: 'act-1', type: 'set_field', config: {} }],
    abortOnError: false,
    isActive: true,
    status: 'published',
    consecutiveErrors: 0,
    executionOrder: 0,
    ...overrides,
  });

  const baseArgs = (overrides: Partial<ExecuteSyncTriggerArgs> = {}): ExecuteSyncTriggerArgs => ({
    collectionId: 'coll-1',
    timing: 'before',
    operation: 'insert',
    record: { id: 'rec-1', name: 'Hello' },
    userContext: { id: 'user-1', email: 'u@example.com', roles: [] },
    ...overrides,
  });

  // ==========================================================================
  // Case 1: collection not found returns empty result with original record
  // ==========================================================================

  it('case 1: missing collection returns empty result preserving the input record', async () => {
    collectionRepo.findOne.mockResolvedValueOnce(null);
    const result = await service.executeSyncTrigger(baseArgs());
    expect(result).toEqual({
      modifiedRecord: { id: 'rec-1', name: 'Hello' },
      errors: [],
      warnings: [],
      asyncQueue: [],
      aborted: false,
    });
    expect(runtimeAnomaly.record).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'record_lookup_missing' }),
    );
  });

  // ==========================================================================
  // Case 2: no automations matched returns the unchanged record
  // ==========================================================================

  it('case 2: no automations match returns input record unmodified', async () => {
    automationsForCollection = [];
    const result = await service.executeSyncTrigger(baseArgs());
    expect(result.modifiedRecord).toEqual({ id: 'rec-1', name: 'Hello' });
    expect(result.aborted).toBe(false);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.asyncQueue).toEqual([]);
  });

  // ==========================================================================
  // Case 3: timing filter — `before` automations skipped when timing='after'
  // ==========================================================================

  it('case 3: timing mismatch skips the automation entirely', async () => {
    automationsForCollection = [automation({ triggerTiming: 'before' })];
    const result = await service.executeSyncTrigger(baseArgs({ timing: 'after' }));
    expect(actionHandler.execute).not.toHaveBeenCalled();
    expect(result.modifiedRecord).toEqual({ id: 'rec-1', name: 'Hello' });
  });

  // ==========================================================================
  // Case 4: operation filter — automation listing 'update' only is skipped on insert
  // ==========================================================================

  it('case 4: operation mismatch skips the automation entirely', async () => {
    automationsForCollection = [automation({ triggerOperations: ['update'] })];
    const result = await service.executeSyncTrigger(baseArgs({ operation: 'insert' }));
    expect(actionHandler.execute).not.toHaveBeenCalled();
    expect(result.modifiedRecord).toEqual({ id: 'rec-1', name: 'Hello' });
  });

  // ==========================================================================
  // Case 5: condition false skips with no result mutation
  // ==========================================================================

  it('case 5: condition evaluating to false skips the automation', async () => {
    conditionEvaluator.evaluate.mockReturnValueOnce({
      result: false,
      trace: { type: 'single', result: false },
      summary: '',
      durationMs: 0,
    });
    automationsForCollection = [automation({ conditionType: 'condition', condition: { property: 'x', operator: 'equals', value: 1 } as never })];
    const result = await service.executeSyncTrigger(baseArgs());
    expect(actionHandler.execute).not.toHaveBeenCalled();
    expect(result.modifiedRecord).toEqual({ id: 'rec-1', name: 'Hello' });
  });

  // ==========================================================================
  // Case 6: modify_record mutates the in-flight record
  // ==========================================================================

  it('case 6: modify_record action returns mutated record without persisting', async () => {
    actionHandler.execute.mockResolvedValueOnce({
      type: 'modify_record',
      changes: { status: 'open' },
      output: 'set status',
    });
    automationsForCollection = [automation()];
    const result = await service.executeSyncTrigger(baseArgs());
    expect(result.modifiedRecord).toEqual({ id: 'rec-1', name: 'Hello', status: 'open' });
    expect(result.aborted).toBe(false);
  });

  // ==========================================================================
  // Case 7: abort action sets aborted=true and abortMessage
  // ==========================================================================

  it('case 7: abort action returns aborted result with message', async () => {
    actionHandler.execute.mockResolvedValueOnce({
      type: 'abort',
      message: 'Status not allowed',
      output: 'aborted',
    });
    automationsForCollection = [automation()];
    const result = await service.executeSyncTrigger(baseArgs());
    expect(result.aborted).toBe(true);
    expect(result.abortMessage).toBe('Status not allowed');
  });

  // ==========================================================================
  // Case 8: add_error accumulates structured error entry
  // ==========================================================================

  it('case 8: add_error action appends to errors array', async () => {
    actionHandler.execute.mockResolvedValueOnce({
      type: 'add_error',
      property: 'name',
      message: 'Required',
      output: 'error',
    });
    automationsForCollection = [automation()];
    const result = await service.executeSyncTrigger(baseArgs());
    expect(result.errors).toEqual([{ property: 'name', message: 'Required' }]);
  });

  // ==========================================================================
  // Case 9: add_warning accumulates structured warning entry
  // ==========================================================================

  it('case 9: add_warning action appends to warnings array', async () => {
    actionHandler.execute.mockResolvedValueOnce({
      type: 'add_warning',
      property: 'priority',
      message: 'Defaulting to low',
      output: 'warning',
    });
    automationsForCollection = [automation()];
    const result = await service.executeSyncTrigger(baseArgs());
    expect(result.warnings).toEqual([{ property: 'priority', message: 'Defaulting to low' }]);
  });

  // ==========================================================================
  // Case 10: create_record queues with executeAfterCommit=true on `before`
  // ==========================================================================

  it('case 10: create_record on before trigger queues with executeAfterCommit=true', async () => {
    actionHandler.execute.mockResolvedValueOnce({
      type: 'create_record',
      output: { collection: 'audit_event', values: { foo: 'bar' } },
    });
    automationsForCollection = [
      automation({ actions: [{ id: 'act-1', type: 'create_record', config: { collection: 'audit_event' } }] }),
    ];
    const result = await service.executeSyncTrigger(baseArgs({ timing: 'before' }));
    expect(result.asyncQueue).toHaveLength(1);
    expect(result.asyncQueue[0]).toEqual({
      action: { id: 'act-1', type: 'create_record', config: { collection: 'audit_event' } },
      executeAsync: true,
      executeAfterCommit: true,
      output: { collection: 'audit_event', values: { foo: 'bar' } },
    });
  });

  // ==========================================================================
  // Case 11: create_record queues with executeAfterCommit=false on `after`
  // ==========================================================================

  it('case 11: create_record on after trigger queues with executeAfterCommit=false', async () => {
    actionHandler.execute.mockResolvedValueOnce({
      type: 'create_record',
      output: { collection: 'audit_event', values: { foo: 'bar' } },
    });
    automationsForCollection = [
      automation({
        triggerTiming: 'after',
        actions: [{ id: 'act-1', type: 'create_record', config: { collection: 'audit_event' } }],
      }),
    ];
    const result = await service.executeSyncTrigger(baseArgs({ timing: 'after' }));
    expect(result.asyncQueue).toHaveLength(1);
    expect(result.asyncQueue[0].executeAfterCommit).toBe(false);
  });

  // ==========================================================================
  // Case 12: depth exceeded short-circuits with chain-depth warning
  // ==========================================================================

  it('case 12: parent depth >= MAX_DEPTH returns chain-depth-exceeded warning', async () => {
    automationsForCollection = [automation()];
    const result = await service.executeSyncTrigger(
      baseArgs({
        parentContext: { depth: 5, executionChain: [] },
      }),
    );
    expect(result.warnings).toEqual([
      { property: '_automation', message: 'Automation chain depth exceeded MAX_DEPTH=5' },
    ]);
    expect(result.aborted).toBe(false);
    expect(actionHandler.execute).not.toHaveBeenCalled();
  });

  // ==========================================================================
  // Case 13: cycle key (automation:record) skips re-entry on same record
  // ==========================================================================

  it('case 13: same (automation, record) re-entry is detected as a cycle and skipped', async () => {
    automationsForCollection = [automation({ id: 'auto-1' })];
    const result = await service.executeSyncTrigger(
      baseArgs({
        parentContext: { depth: 1, executionChain: ['auto-1:rec-1'] },
      }),
    );
    expect(actionHandler.execute).not.toHaveBeenCalled();
    expect(result.modifiedRecord).toEqual({ id: 'rec-1', name: 'Hello' });
  });

  // ==========================================================================
  // Case 14: delete operation suppresses modify_record but accepts add_error
  // ==========================================================================

  it('case 14: modify_record on delete operation produces a warning instead of mutating', async () => {
    actionHandler.execute.mockResolvedValueOnce({
      type: 'modify_record',
      changes: { archived: true },
      output: 'modified',
    });
    automationsForCollection = [
      automation({ triggerOperations: ['delete'] }),
    ];
    const result = await service.executeSyncTrigger(baseArgs({ operation: 'delete' }));
    expect(result.modifiedRecord).toEqual({ id: 'rec-1', name: 'Hello' });
    expect(result.warnings).toContainEqual({
      property: '_automation',
      message: 'Modify record action skipped on delete event',
    });
  });

  // ==========================================================================
  // Frozen-shape check — guarantees the response keys never silently move.
  // ==========================================================================

  it('result shape includes exactly the contract keys', async () => {
    const result: SyncTriggerResult = await service.executeSyncTrigger(baseArgs());
    const keys = Object.keys(result).sort();
    expect(keys).toEqual([
      'aborted',
      'asyncQueue',
      'errors',
      'modifiedRecord',
      'warnings',
    ]);
  });
});
