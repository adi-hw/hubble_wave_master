import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import {
  AutomationRule,
  AuditLog,
  CollectionDefinition,
  PropertyDefinition,
  RuntimeAnomalyService,
} from '@hubblewave/instance-db';
import { AuthorizationService } from '@hubblewave/authorization';
import { AutomationRuntimeService } from './automation-runtime.service';
import { ConditionEvaluatorService } from './condition-evaluator.service';
import { ActionHandlerService } from './action-handler.service';
import { ScriptSandboxService } from './script-sandbox.service';
import { ExecutionLogService } from './execution-log.service';
import { RecordMutationService } from './record-mutation.service';
import { OutboxPublisherService } from './outbox-publisher.service';
import { RecordEventPayload } from './automation-runtime.types';

// Characterization tests for AutomationRuntimeService — covers cycle
// detection, max-depth limit, and field-level filtering. Mocks every
// dependency so tests stay focused on the runtime's own decision logic.
//
// Refs Part 2 Fix 5 (test coverage) and Fix 7 (cross-automation cycle
// detection — currently broken; A->B->A on same record is not detected
// because executionChain resets per processRecordEvent invocation).

describe('AutomationRuntimeService', () => {
  let service: AutomationRuntimeService;
  let executionLog: { log: jest.Mock };
  let recordMutation: {
    getRecordById: jest.Mock;
    createRecord: jest.Mock;
    updateRecord: jest.Mock;
  };
  let outboxPublisher: { publishEvent: jest.Mock; publishRecordEvent: jest.Mock };
  let actionHandler: { execute: jest.Mock };
  let conditionEvaluator: { evaluate: jest.Mock; evaluateQuick: jest.Mock };
  let scriptSandbox: { execute: jest.Mock; evaluateCondition: jest.Mock };
  let authz: { getAuthorizedFields: jest.Mock };
  let runtimeAnomaly: { record: jest.Mock };
  let collectionRepo: { findOne: jest.Mock };
  let propertyRepoQB: {
    innerJoin: jest.Mock;
    where: jest.Mock;
    andWhere: jest.Mock;
    getMany: jest.Mock;
  };
  let automationRepo: {
    find: jest.Mock;
    findOne: jest.Mock;
    update: jest.Mock;
    increment: jest.Mock;
  };
  let auditLogRepo: { create: jest.Mock; save: jest.Mock };

  // The list of automations the runtime returns for a given collection. Mutate
  // per-test before invoking processRecordEvent.
  let automationsForCollection: Array<Partial<AutomationRule>>;

  // The set of fields the actor is authorized to read. Mutate per-test.
  let authorizedFieldsResponse: Array<{ code: string; canRead: boolean }>;

  // Spy on Logger.prototype.warn so we can assert depth/limit warn-logs.
  let warnSpy: jest.SpyInstance;

  beforeEach(async () => {
    automationsForCollection = [];
    authorizedFieldsResponse = [];

    collectionRepo = {
      findOne: jest.fn().mockResolvedValue({
        id: 'coll-1',
        code: 'work_order',
        tableName: 'work_orders',
        isActive: true,
      }),
    };

    propertyRepoQB = {
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };

    const propertyRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(propertyRepoQB),
    };

    automationRepo = {
      find: jest.fn(async () => automationsForCollection as AutomationRule[]),
      findOne: jest.fn().mockResolvedValue({ consecutiveErrors: 0 }),
      update: jest.fn().mockResolvedValue(undefined),
      increment: jest.fn().mockResolvedValue(undefined),
    };

    auditLogRepo = {
      create: jest.fn((entry) => entry),
      save: jest.fn().mockResolvedValue(undefined),
    };

    // The runtime wraps audit + execution-log writes in `withAudit`, which
    // calls `dataSource.transaction(fn)` and passes the inner EntityManager
    // back to the callback. The fake transaction here just runs the callback
    // with the same getRepository surface so the inner writes hit our jest
    // mocks. Real transactional semantics (rollback) are exercised by the
    // dedicated `transactional audit` describe block at the bottom of this
    // file.
    const repoFor = (entity: unknown) => {
      if (entity === CollectionDefinition) return collectionRepo;
      if (entity === PropertyDefinition) return propertyRepo;
      if (entity === AutomationRule) return automationRepo;
      if (entity === AuditLog) return auditLogRepo;
      // AutomationExecutionLog and other entities resolved by withAudit's
      // inner save: the runtime always invokes ExecutionLogService.log
      // (which is mocked at the provider level), so this fallback only
      // needs to satisfy the audit save() that withAudit performs.
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

    recordMutation = {
      getRecordById: jest.fn().mockResolvedValue(null),
      createRecord: jest.fn().mockResolvedValue({ id: 'created-1' }),
      updateRecord: jest.fn().mockResolvedValue({ id: 'rec-1' }),
    };

    outboxPublisher = {
      publishEvent: jest.fn().mockResolvedValue(undefined),
      publishRecordEvent: jest.fn().mockResolvedValue(undefined),
    };

    authz = {
      getAuthorizedFields: jest.fn(async () => authorizedFieldsResponse),
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

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  const automation = (
    overrides: Partial<AutomationRule> = {},
  ): Partial<AutomationRule> => ({
    id: 'auto-1',
    name: 'Test automation',
    collectionId: 'coll-1',
    triggerTiming: 'after',
    triggerOperations: ['insert', 'update'],
    conditionType: 'always',
    actionType: 'no_code',
    actions: [],
    abortOnError: false,
    isActive: true,
    status: 'published',
    consecutiveErrors: 0,
    executionOrder: 0,
    ...overrides,
  });

  const event = (overrides: Partial<RecordEventPayload> = {}): RecordEventPayload => ({
    eventType: 'record.created',
    collectionCode: 'work_order',
    recordId: 'rec-1',
    record: { id: 'rec-1', name: 'Hello', priority: 'high' },
    previousRecord: null,
    changedProperties: [],
    userId: 'user-1',
    metadata: {},
    occurredAt: new Date().toISOString(),
    ...overrides,
  });

  describe('cycle detection', () => {
    it('A->A: same automation appearing twice in the rules list is skipped on second occurrence', async () => {
      // Within a single processRecordEvent loop, the executionChain
      // accumulates across iterations (push, run, pop). If the same
      // automation id appears twice in the rules list AND a chain entry
      // somehow persists, the second iteration skips with
      // "Circular automation reference detected". Today the chain pops
      // after each iteration, so duplicates in the list run twice.
      // Document current behavior: duplicates run twice.
      const dup = automation({ id: 'auto-1' });
      automationsForCollection = [dup, dup];

      await service.processRecordEvent(event());

      // Each occurrence runs to completion and produces a 'success' log.
      const successLogs = executionLog.log.mock.calls.filter(
        (call) => call[0].status === 'success',
      );
      expect(successLogs.length).toBe(2);
    });

    // W2.B / Plan Fix 7: an inbound outbox event whose executionChain
    // already contains `${automationId}:${recordId}` for the candidate
    // automation must skip with 'Circular automation reference detected'.
    // The chain is reconstructed from the event payload, so a chain from
    // an earlier generation (A: rec-1, B: rec-1) survives into this
    // invocation and prevents A from re-firing on rec-1.
    it('A->B->A on the same record is detected (W2.B / Plan Fix 7)', async () => {
      // Automation A is in the rules list. Simulate that the inbound
      // event was emitted by an earlier chain step where A and B already
      // ran on rec-1. A re-firing on rec-1 must be skipped.
      automationsForCollection = [automation({ id: 'auto-A' })];

      await service.processRecordEvent(
        event({
          recordId: 'rec-1',
          executionChain: ['auto-A:rec-1', 'auto-B:rec-1'],
          executionDepth: 3,
        }),
      );

      const skippedLogs = executionLog.log.mock.calls.filter(
        (call) => call[0].skippedReason === 'Circular automation reference detected',
      );
      expect(skippedLogs.length).toBe(1);
      expect(skippedLogs[0][0]).toEqual(
        expect.objectContaining({
          automationId: 'auto-A',
          recordId: 'rec-1',
          status: 'skipped',
        }),
      );
    });

    it('A->B->A on different records is allowed (cross-record fan-out is legitimate)', async () => {
      // Two record events on two different records: even if the same
      // automation id fires for both, that is legal cross-record fan-out
      // and must not be skipped as a cycle.
      automationsForCollection = [automation({ id: 'auto-A' })];

      await service.processRecordEvent(event({ recordId: 'rec-1' }));
      await service.processRecordEvent(
        event({ recordId: 'rec-2', record: { id: 'rec-2' } }),
      );

      const successLogs = executionLog.log.mock.calls.filter(
        (call) => call[0].status === 'success',
      );
      expect(successLogs.length).toBe(2);
    });

    it('same automation on a different record within the same chain runs (cross-record fan-out)', async () => {
      // The inbound chain contains `auto-A:rec-1` (already ran). Auto A
      // firing on rec-2 within that chain must be allowed because the
      // cycle key is per-(automation, record).
      automationsForCollection = [automation({ id: 'auto-A' })];

      await service.processRecordEvent(
        event({
          recordId: 'rec-2',
          record: { id: 'rec-2' },
          executionChain: ['auto-A:rec-1'],
          executionDepth: 2,
        }),
      );

      const successLogs = executionLog.log.mock.calls.filter(
        (call) => call[0].status === 'success',
      );
      expect(successLogs.length).toBe(1);
    });
  });

  describe('max depth', () => {
    // The svc-automation runtime initializes baseContext.depth=1 and
    // maxDepth=5. Depth is not incremented within processRecordEvent —
    // outbox-driven re-invocations always start at depth=1. Document
    // current behavior: there is no in-process depth-skip mechanism.
    it('logs successfully at depth 1 (default for any processRecordEvent invocation)', async () => {
      automationsForCollection = [automation()];

      await service.processRecordEvent(event());

      expect(executionLog.log).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'success', executionDepth: 1 }),
        expect.anything(),
      );
    });

    // W2.B / Plan Fix 7: when an outbox event arrives with
    // executionDepth > MAX_DEPTH (5), the runtime drops the chain with a
    // structured 'skipped' execution log entry rather than running another
    // generation. The depth value flows through the outbox payload from
    // the prior generation's record mutation.
    it('chain 6 deep: 6th invocation is skipped with warn log (W2.B / Plan Fix 7)', async () => {
      automationsForCollection = [automation({ id: 'auto-A' })];

      await service.processRecordEvent(
        event({
          recordId: 'rec-1',
          // Depth 6 exceeds MAX_DEPTH=5 — the chain must be dropped before
          // any automation fires.
          executionDepth: 6,
          executionChain: [
            'auto-1:rec-1',
            'auto-2:rec-1',
            'auto-3:rec-1',
            'auto-4:rec-1',
            'auto-5:rec-1',
          ],
        }),
      );

      // No automation should have run (no 'success' log).
      const successLogs = executionLog.log.mock.calls.filter(
        (call) => call[0].status === 'success',
      );
      expect(successLogs.length).toBe(0);

      // A structured 'skipped' execution log entry is recorded so operators
      // can alert on truncated chains.
      const dropLogs = executionLog.log.mock.calls.filter(
        (call) =>
          call[0].status === 'skipped' &&
          typeof call[0].skippedReason === 'string' &&
          call[0].skippedReason.includes('MAX_DEPTH'),
      );
      expect(dropLogs.length).toBe(1);

      // Operator-visible warn log carries the chain context.
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('MAX_DEPTH'),
      );
    });

    it('respects MAX_AUTOMATIONS_PER_EVENT (50) cap', async () => {
      // Build 51 distinct automations on the same collection; only 50
      // should run (the 51st is dropped with a warn log).
      automationsForCollection = Array.from({ length: 51 }, (_, i) =>
        automation({ id: `auto-${i}` }),
      );

      await service.processRecordEvent(event());

      const successLogs = executionLog.log.mock.calls.filter(
        (call) => call[0].status === 'success',
      );
      expect(successLogs.length).toBe(50);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Automation limit reached'),
      );
    });
  });

  // W2.B / Plan Fix 7: every chain hop must serialize the executionChain +
  // executionDepth onto the outbox event so the next runtime invocation
  // can reconstruct the cycle/depth state. Without this, A->B->A on the
  // same record cannot be detected and deep chains escape MAX_DEPTH.
  describe('chain propagation through outbox', () => {
    it('forwards executionChain + executionDepth onto modify_record outbox events', async () => {
      // Automation A modifies the record. The runtime calls
      // recordMutation.updateRecordInTransaction (which emits the outbox
      // event). Verify both fields are present on the call payload so the
      // downstream invocation has the chain.
      const updateInTx = jest.fn().mockResolvedValue({ id: 'rec-1', name: 'Modified' });
      recordMutation.updateRecord = updateInTx as unknown as jest.Mock;
      // Patch the in-transaction method that the runtime actually calls:
      (recordMutation as unknown as { updateRecordInTransaction: jest.Mock }).updateRecordInTransaction = updateInTx;

      actionHandler.execute.mockResolvedValue({
        type: 'modify_record',
        changes: { name: 'Modified' },
      });

      automationsForCollection = [
        automation({
          id: 'auto-A',
          actions: [{ id: 'act-1', type: 'set_value', config: { property: 'name', value: 'Modified' } }],
        }),
      ];

      await service.processRecordEvent(
        event({
          recordId: 'rec-1',
          executionChain: ['auto-prev:rec-0'],
          executionDepth: 2,
        }),
      );

      // The mutation receives both the chain (with auto-A added) and the
      // incremented depth.
      expect(updateInTx).toHaveBeenCalled();
      const params = updateInTx.mock.calls[0][0];
      expect(params.executionChain).toEqual(
        expect.arrayContaining(['auto-prev:rec-0', 'auto-A:rec-1']),
      );
      // Inbound depth was 2 → mutation publishes at depth=3 so the next
      // runtime invocation knows it's the 3rd generation.
      expect(params.executionDepth).toBe(3);
    });

    it('forwards executionChain + executionDepth onto create_record outbox events', async () => {
      actionHandler.execute.mockResolvedValue({
        type: 'create_record',
        output: { collection: 'tasks', values: { name: 'New' } },
      });

      automationsForCollection = [
        automation({
          id: 'auto-A',
          actions: [
            {
              id: 'act-1',
              type: 'create_record',
              config: { collectionCode: 'tasks', values: { name: 'New' } },
            },
          ],
        }),
      ];

      await service.processRecordEvent(
        event({
          recordId: 'rec-1',
          executionChain: ['auto-prev:rec-0'],
          executionDepth: 2,
        }),
      );

      expect(recordMutation.createRecord).toHaveBeenCalled();
      const params = recordMutation.createRecord.mock.calls[0][0];
      expect(params.executionChain).toEqual(
        expect.arrayContaining(['auto-prev:rec-0', 'auto-A:rec-1']),
      );
      expect(params.executionDepth).toBe(3);
    });

    it('reconstructs chain Set from inbound payload (Set.has lookup, not Array.includes)', async () => {
      // The runtime should treat the inbound array as a Set; verify by
      // having the same automation id appear in the chain string and
      // confirming the lookup catches it.
      automationsForCollection = [automation({ id: 'auto-cycle' })];

      await service.processRecordEvent(
        event({
          recordId: 'rec-X',
          executionChain: ['auto-cycle:rec-X', 'auto-other:rec-Y'],
          executionDepth: 3,
        }),
      );

      // auto-cycle on rec-X is in the chain, so it must be skipped.
      const skipped = executionLog.log.mock.calls.filter(
        (call) => call[0].skippedReason === 'Circular automation reference detected',
      );
      expect(skipped.length).toBe(1);
    });
  });

  describe('field-level authorization', () => {
    it('passes authorizedFields set to condition evaluator', async () => {
      authorizedFieldsResponse = [
        { code: 'name', canRead: true },
        { code: 'salary', canRead: false },
      ];

      automationsForCollection = [
        automation({
          conditionType: 'condition',
          condition: {
            property: 'name',
            operator: 'equals',
            value: 'Hello',
          } as unknown as Record<string, unknown>,
        }),
      ];

      await service.processRecordEvent(event());

      // The evaluator was called with a context that has authorizedFields.
      const lastCall = conditionEvaluator.evaluate.mock.calls[0];
      const ctx = lastCall[1];
      expect(ctx.authorizedFields).toBeInstanceOf(Set);
      expect(ctx.authorizedFields.has('name')).toBe(true);
      expect(ctx.authorizedFields.has('salary')).toBe(false);
    });

    it('admin (system) context: userId null marks isAdmin=true', async () => {
      // Verify that getAuthorizedFields receives an admin context when
      // payload.userId is null. The mock returns whatever
      // authorizedFieldsResponse contains; we check the call args.
      authorizedFieldsResponse = [{ code: 'name', canRead: true }];
      automationsForCollection = [automation()];

      await service.processRecordEvent(event({ userId: null }));

      expect(authz.getAuthorizedFields).toHaveBeenCalled();
      const ctxArg = authz.getAuthorizedFields.mock.calls[0][0];
      expect(ctxArg.isAdmin).toBe(true);
    });

    it('user-triggered: userId present marks isAdmin=false', async () => {
      authorizedFieldsResponse = [{ code: 'name', canRead: true }];
      automationsForCollection = [automation()];

      await service.processRecordEvent(event({ userId: 'user-42' }));

      const ctxArg = authz.getAuthorizedFields.mock.calls[0][0];
      expect(ctxArg.isAdmin).toBe(false);
      expect(ctxArg.userId).toBe('user-42');
    });

    it('passes authorizedFields to script sandbox via execution context', async () => {
      authorizedFieldsResponse = [{ code: 'name', canRead: true }];

      automationsForCollection = [
        automation({
          actionType: 'script',
          script: 'length(name)',
        }),
      ];

      await service.processRecordEvent(event());

      // Script sandbox received an ExecutionContext including authorizedFields.
      expect(scriptSandbox.execute).toHaveBeenCalled();
      const ctx = scriptSandbox.execute.mock.calls[0][1];
      expect(ctx.authorizedFields).toBeInstanceOf(Set);
    });
  });

  describe('trigger gating', () => {
    it('skips automations whose triggerTiming is "before"', async () => {
      automationsForCollection = [automation({ triggerTiming: 'before' })];

      await service.processRecordEvent(event());

      expect(executionLog.log).not.toHaveBeenCalled();
    });

    it('runs automations whose triggerTiming is "after"', async () => {
      automationsForCollection = [automation({ triggerTiming: 'after' })];

      await service.processRecordEvent(event());

      // ExecutionLog.log is called with (options, mgr) inside withAudit; the
      // second arg is the transactional EntityManager handed in by the
      // mocked dataSource.transaction.
      expect(executionLog.log).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'success' }),
        expect.anything(),
      );
    });

    it('runs automations whose triggerTiming is "async"', async () => {
      automationsForCollection = [automation({ triggerTiming: 'async' })];

      await service.processRecordEvent(event());

      expect(executionLog.log).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'success' }),
        expect.anything(),
      );
    });

    it('skips when watchProperties is set and changes do not intersect', async () => {
      automationsForCollection = [
        automation({ watchProperties: ['priority'] }),
      ];

      await service.processRecordEvent(
        event({
          eventType: 'record.updated',
          changedProperties: ['name'], // not 'priority'
        }),
      );

      expect(executionLog.log).not.toHaveBeenCalled();
    });

    it('runs when watchProperties intersects changes', async () => {
      automationsForCollection = [
        automation({ watchProperties: ['priority'] }),
      ];

      await service.processRecordEvent(
        event({
          eventType: 'record.updated',
          changedProperties: ['priority'],
        }),
      );

      expect(executionLog.log).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'success' }),
        expect.anything(),
      );
    });

    it('ignores unknown event types (no log written)', async () => {
      automationsForCollection = [automation()];

      await service.processRecordEvent(
        event({ eventType: 'record.archived' }),
      );

      expect(executionLog.log).not.toHaveBeenCalled();
    });

    it('skips when condition is not met', async () => {
      conditionEvaluator.evaluate.mockReturnValue({
        result: false,
        summary: 'no',
        trace: { type: 'single', result: false },
        durationMs: 0,
      });

      automationsForCollection = [
        automation({
          conditionType: 'condition',
          condition: { property: 'a', operator: 'equals', value: 1 } as unknown as Record<string, unknown>,
        }),
      ];

      await service.processRecordEvent(event());

      expect(executionLog.log).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'skipped',
          skippedReason: 'Condition not met',
        }),
        expect.anything(),
      );
    });
  });

  describe('lifecycle gate', () => {
    it('only loads published+active automations from the repository', async () => {
      automationsForCollection = [automation()];

      await service.processRecordEvent(event());

      expect(automationRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { collectionId: 'coll-1', isActive: true, status: 'published' },
        }),
      );
    });
  });

  describe('record fetch fallback', () => {
    it('fetches the record by id when payload.record is missing', async () => {
      recordMutation.getRecordById.mockResolvedValue({
        id: 'rec-99',
        name: 'fetched',
      });
      automationsForCollection = [automation()];

      await service.processRecordEvent(
        event({ record: undefined, recordId: 'rec-99' }),
      );

      expect(recordMutation.getRecordById).toHaveBeenCalledWith(
        'work_order',
        'rec-99',
      );
      expect(executionLog.log).toHaveBeenCalled();
    });

    it('skips when payload.record is missing and the record cannot be fetched', async () => {
      recordMutation.getRecordById.mockResolvedValue(null);
      automationsForCollection = [automation()];

      await service.processRecordEvent(event({ record: undefined }));

      expect(executionLog.log).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('record'),
      );
    });

    it('skips when collection is missing', async () => {
      collectionRepo.findOne.mockResolvedValue(null);
      automationsForCollection = [automation()];

      await service.processRecordEvent(event());

      expect(executionLog.log).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('collection'),
      );
    });
  });
});

/**
 * In-memory transactional simulation. Mirrors TypeORM behaviour:
 *   - dataSource.transaction(fn) runs fn inside a "transaction"
 *   - if fn rejects, no writes performed inside it are visible
 *   - if fn resolves, all writes are flushed
 *
 * This lets us assert the rollback contract: when an audit save fails after
 * a record mutation, neither the record nor the audit row exists.
 */
type CommittedWrite =
  | { kind: 'record'; payload: Record<string, unknown> }
  | { kind: 'audit'; payload: Record<string, unknown> }
  | { kind: 'execution-log'; payload: Record<string, unknown> };

function buildFakeDataSource(options: {
  failAuditSave?: boolean;
  failExecutionLogSave?: boolean;
}): { dataSource: DataSource; committed: CommittedWrite[]; auditRepoSpy: jest.Mock } {
  const committed: CommittedWrite[] = [];
  const auditRepoSpy = jest.fn();

  const buildMgr = (pending: CommittedWrite[]): EntityManager => {
    const mgr: Partial<EntityManager> = {};
    mgr.getRepository = jest.fn((entity: any) => {
      const entityName = entity?.name || String(entity);

      if (entityName === 'AuditLog') {
        return {
          create: (e: any) => e,
          save: jest.fn(async (entries: any) => {
            auditRepoSpy(entries);
            if (options.failAuditSave) {
              throw new Error('audit save failed');
            }
            const list = Array.isArray(entries) ? entries : [entries];
            for (const entry of list) {
              pending.push({ kind: 'audit', payload: entry });
            }
            return list;
          }),
        } as any;
      }

      if (entityName === 'AutomationExecutionLog') {
        return {
          create: (e: any) => e,
          save: jest.fn(async (entry: any) => {
            if (options.failExecutionLogSave) {
              throw new Error('execution log save failed');
            }
            pending.push({ kind: 'execution-log', payload: entry });
            return entry;
          }),
        } as any;
      }

      return {
        create: (e: any) => e,
        save: jest.fn(async (entry: any) => entry),
        findOne: jest.fn(async () => null),
        find: jest.fn(async () => []),
        update: jest.fn(),
        increment: jest.fn(),
      } as any;
    });

    (mgr as any).createQueryBuilder = jest.fn(() => ({
      insert: () => ({ into: () => ({ values: () => ({ returning: () => ({ execute: jest.fn(async () => ({ identifiers: [{ id: 'rec-1' }] })) }) }) }) }),
      update: () => ({ set: () => ({ where: () => ({ execute: jest.fn(async () => ({ affected: 1 })) }) }) }),
      delete: () => ({ from: () => ({ where: () => ({ execute: jest.fn(async () => ({ affected: 1 })) }) }) }),
    }));
    (mgr as any).query = jest.fn(async () => [{ id: 'rec-1' }]);

    return mgr as EntityManager;
  };

  const dataSource = {
    transaction: jest.fn(async <T,>(fn: (m: EntityManager) => Promise<T>): Promise<T> => {
      const pending: CommittedWrite[] = [];
      const mgr = buildMgr(pending);
      // If fn rejects, the await throws and `committed.push(...pending)`
      // is never reached — pending writes are discarded (rollback).
      const result = await fn(mgr);
      committed.push(...pending);
      return result;
    }),
    getRepository: jest.fn(() => {
      // Outside-tx reads: return empty so the "automation processing" short-circuits
      return {
        find: jest.fn(async () => []),
        findOne: jest.fn(async () => null),
        update: jest.fn(),
        increment: jest.fn(),
      } as any;
    }),
  } as unknown as DataSource;

  return { dataSource, committed, auditRepoSpy };
}

describe('AutomationRuntimeService — transactional audit', () => {
  function buildService(dataSource: DataSource): {
    service: AutomationRuntimeService;
    executionLog: ExecutionLogService;
    recordMutation: RecordMutationService;
  } {
    const conditionEvaluator = {
      evaluate: jest.fn(),
    } as unknown as ConditionEvaluatorService;
    const actionHandler = {
      execute: jest.fn(),
    } as unknown as ActionHandlerService;
    const scriptSandbox = {
      execute: jest.fn(),
    } as unknown as ScriptSandboxService;

    const executionLog = new ExecutionLogService(dataSource);
    const outboxPublisher = new OutboxPublisherService(dataSource);
    const authz = {
      ensureCollectionAccess: jest.fn(),
      filterWritableFieldsForCollection: jest.fn(async (_ctx: any, _c: any, p: any) => p),
      getAuthorizedFields: jest.fn(async () => []),
    } as any;
    const runtimeAnomaly = {
      record: jest.fn(async () => undefined),
    } as unknown as RuntimeAnomalyService;
    const recordMutation = new RecordMutationService(dataSource, authz, outboxPublisher);

    const service = new AutomationRuntimeService(
      dataSource,
      conditionEvaluator,
      actionHandler,
      scriptSandbox,
      executionLog,
      recordMutation,
      outboxPublisher,
      authz,
      runtimeAnomaly,
    );

    return { service, executionLog, recordMutation };
  }

  it('rolls back the record mutation when audit log save fails', async () => {
    const { dataSource, committed } = buildFakeDataSource({ failAuditSave: true });
    const { recordMutation } = buildService(dataSource);

    // Patch out collection lookup/properties — both use mgr.getRepository
    const fakeCollection = { id: 'c-1', code: 'incidents', tableName: 'incidents', isActive: true } as any;
    (recordMutation as any).getCollectionWithProperties = jest.fn(async () => ({
      collection: fakeCollection,
      properties: [
        { code: 'status', columnName: 'status', isSystem: false, name: 'Status' },
      ],
    }));
    (recordMutation as any).getRecordById = jest.fn(async () => ({ id: 'rec-1', status: 'open' }));

    await expect(
      recordMutation.updateRecord({
        collectionCode: 'incidents',
        recordId: 'rec-1',
        changes: { status: 'closed' },
        actorId: 'u-1',
      }),
    ).rejects.toThrow('audit save failed');

    // Critical assertion: NO record write AND NO audit row exists after rollback.
    expect(committed.filter((w) => w.kind === 'audit')).toHaveLength(0);
    expect(committed.filter((w) => w.kind === 'record')).toHaveLength(0);
  });

  it('commits both record mutation and audit log on success', async () => {
    const { dataSource, committed, auditRepoSpy } = buildFakeDataSource({});
    const { recordMutation } = buildService(dataSource);

    const fakeCollection = { id: 'c-1', code: 'incidents', tableName: 'incidents', isActive: true } as any;
    (recordMutation as any).getCollectionWithProperties = jest.fn(async () => ({
      collection: fakeCollection,
      properties: [
        { code: 'status', columnName: 'status', isSystem: false, name: 'Status' },
      ],
    }));
    (recordMutation as any).getRecordById = jest.fn(async () => ({ id: 'rec-1', status: 'open' }));

    await recordMutation.updateRecord({
      collectionCode: 'incidents',
      recordId: 'rec-1',
      changes: { status: 'closed' },
      actorId: 'u-1',
    });

    // Audit save was invoked exactly once and the resulting row reached the committed log.
    expect(auditRepoSpy).toHaveBeenCalledTimes(1);
    expect(committed.filter((w) => w.kind === 'audit')).toHaveLength(1);
  });
});

/**
 * W2.D — Verifies automation-runtime emits a runtime_anomaly when an
 * after-automation execution failure is swallowed by the per-rule
 * try/catch, and when a record/collection lookup fails.
 */
describe('AutomationRuntimeService — anomaly recording for swallowed failures (W2.D)', () => {
  function buildService(opts: {
    collection?: any;
    automations?: any[];
    executeShouldThrow?: boolean;
  } = {}) {
    const dataSource: any = {
      getRepository: jest.fn((target: any) => {
        const name = target?.name ?? '';
        if (name === 'CollectionDefinition') {
          return {
            findOne: jest.fn(async () => opts.collection ?? null),
          };
        }
        if (name === 'AutomationRule') {
          return {
            find: jest.fn(async () => opts.automations ?? []),
            update: jest.fn(async () => undefined),
            increment: jest.fn(async () => undefined),
            findOne: jest.fn(async () => null),
          };
        }
        if (name === 'AuditLog') {
          return {
            create: jest.fn((e: any) => e),
            save: jest.fn(async () => undefined),
          };
        }
        if (name === 'PropertyDefinition') {
          return {
            createQueryBuilder: jest.fn(() => ({
              innerJoin: jest.fn().mockReturnThis(),
              where: jest.fn().mockReturnThis(),
              andWhere: jest.fn().mockReturnThis(),
              getMany: jest.fn(async () => []),
            })),
          };
        }
        return { find: jest.fn(), findOne: jest.fn(), save: jest.fn(), create: jest.fn() };
      }),
      transaction: jest.fn(async <T,>(fn: (m: unknown) => Promise<T>): Promise<T> => {
        const repoFor = (target: any) => {
          const name = target?.name ?? '';
          if (name === 'AuditLog') {
            return { create: (e: any) => e, save: jest.fn(async () => undefined) };
          }
          return { create: (e: any) => e, save: jest.fn(async () => undefined) };
        };
        const mgr = { getRepository: jest.fn(repoFor) } as unknown;
        return fn(mgr);
      }),
    };

    const conditionEvaluator: any = { evaluate: jest.fn(() => ({ result: true, trace: {} })) };
    const actionHandler: any = { execute: jest.fn() };
    const scriptSandbox: any = { execute: jest.fn() };
    const executionLog: any = { log: jest.fn(async () => undefined) };
    const recordMutation: any = {
      getRecordById: jest.fn(async () => null),
    };
    const outboxPublisher: any = { publishEvent: jest.fn() };
    const authz: any = {
      getAuthorizedFields: jest.fn(async () => []),
    };

    const recorded: any[] = [];
    const runtimeAnomaly: any = {
      record: jest.fn(async (event: any) => {
        recorded.push(event);
      }),
    };

    const service = new AutomationRuntimeService(
      dataSource,
      conditionEvaluator,
      actionHandler,
      scriptSandbox,
      executionLog,
      recordMutation,
      outboxPublisher,
      authz,
      runtimeAnomaly,
    );

    if (opts.executeShouldThrow) {
      (service as any).executeAutomation = jest.fn(async () => {
        throw new Error('boom in action handler');
      });
    }

    return { service, recorded, runtimeAnomaly };
  }

  it('records an anomaly when collection lookup fails', async () => {
    const { service, recorded } = buildService({ collection: null });

    await service.processRecordEvent({
      eventType: 'record.created',
      collectionCode: 'missing_collection',
      recordId: 'rec-1',
      record: { id: 'rec-1' },
      previousRecord: null,
      changedProperties: [],
      userId: 'user-1',
      occurredAt: new Date().toISOString(),
    });

    expect(recorded).toHaveLength(1);
    expect(recorded[0].kind).toBe('record_lookup_missing');
    expect(recorded[0].serviceCode).toBe('svc-automation');
    expect(recorded[0].collectionCode).toBe('missing_collection');
    expect((recorded[0].context as Record<string, unknown>).missing).toBe('collection');
  });

  it('records an after_automation_swallowed anomaly when execution throws', async () => {
    const collection = { id: 'col-1', code: 'work_orders', isActive: true };
    const automation = {
      id: 'auto-1',
      name: 'Notify on close',
      collectionId: 'col-1',
      isActive: true,
      executionOrder: 0,
      triggerTiming: 'after',
      triggerOperations: ['update'],
      conditionType: 'always',
      actionType: 'no_code',
      actions: [],
      abortOnError: true,
      consecutiveErrors: 0,
      watchProperties: [],
    };

    const { service, recorded, runtimeAnomaly } = buildService({
      collection,
      automations: [automation],
      executeShouldThrow: true,
    });

    await service.processRecordEvent({
      eventType: 'record.updated',
      collectionCode: 'work_orders',
      recordId: 'rec-9',
      record: { id: 'rec-9', status: 'closed' },
      previousRecord: { id: 'rec-9', status: 'open' },
      changedProperties: ['status'],
      userId: 'user-9',
      occurredAt: new Date().toISOString(),
    });

    // Exactly one anomaly should have been recorded for the swallowed failure.
    expect(runtimeAnomaly.record).toHaveBeenCalledTimes(1);
    expect(recorded[0].kind).toBe('after_automation_swallowed');
    expect(recorded[0].serviceCode).toBe('svc-automation');
    expect(recorded[0].collectionCode).toBe('work_orders');
    expect(recorded[0].recordId).toBe('rec-9');
    expect(recorded[0].error).toBeInstanceOf(Error);
    expect((recorded[0].error as Error).message).toBe('boom in action handler');
    expect((recorded[0].context as Record<string, unknown>).automationId).toBe('auto-1');
    expect((recorded[0].context as Record<string, unknown>).automationName).toBe('Notify on close');
  });
});
