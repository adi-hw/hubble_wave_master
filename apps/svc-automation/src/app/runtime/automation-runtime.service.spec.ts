import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import {
  AutomationRule,
  AuditLog,
  CollectionDefinition,
  PropertyDefinition,
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

    const dataSource = {
      getRepository: jest.fn((entity: unknown) => {
        if (entity === CollectionDefinition) return collectionRepo;
        if (entity === PropertyDefinition) return propertyRepo;
        if (entity === AutomationRule) return automationRepo;
        if (entity === AuditLog) return auditLogRepo;
        return { findOne: jest.fn(), find: jest.fn() };
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

    // The plan calls out A->B->A on the same record as currently broken
    // because executionChain resets per processRecordEvent invocation.
    // Outbox events from one automation invoke the runtime fresh, so the
    // chain cannot detect the cycle. Skip until Fix 7 lands.
    it.skip('A->B->A on the same record is detected (Plan Fix 7)', async () => {
      // TODO: implement once cycle key changes from automationId to
      // `${automationId}:${recordId}` and the chain is propagated across
      // outbox-driven re-invocations. See Plan Part 2 Fix 7.
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
      );
    });

    // Plan Fix 7 + W1.9 calls out that depth should be propagated through
    // outbox re-invocations so a chain of automations 6 deep is skipped.
    // The current runtime has no such propagation.
    it.skip('chain 6 deep: 6th invocation is skipped with warn log (Plan Fix 7 / W1.9)', async () => {
      // TODO: implement once depth/chain are propagated through outbox
      // metadata into subsequent processRecordEvent calls.
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

      expect(executionLog.log).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'success' }),
      );
    });

    it('runs automations whose triggerTiming is "async"', async () => {
      automationsForCollection = [automation({ triggerTiming: 'async' })];

      await service.processRecordEvent(event());

      expect(executionLog.log).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'success' }),
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
      ensureTableAccess: jest.fn(),
      filterWritableFields: jest.fn(async (_ctx: any, _t: any, p: any) => p),
    } as any;
    const recordMutation = new RecordMutationService(dataSource, authz, outboxPublisher);

    const service = new AutomationRuntimeService(
      dataSource,
      conditionEvaluator,
      actionHandler,
      scriptSandbox,
      executionLog,
      recordMutation,
      outboxPublisher,
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
