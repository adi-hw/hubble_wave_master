// Test-only stub for `@hubblewave/instance-db`.
//
// The real barrel re-exports a number of entity files that exist as forward
// declarations on master but have not yet had their entity TypeScript files
// committed (they're in-flight from a parallel slice). Loading the real
// barrel inside a unit test triggers a `Cannot find module` error before any
// test can run. We expose just the entity classes and helpers svc-automation
// needs at unit-test time. Production code paths still go through the real
// library at build time.

class StubEntity {
  id?: string;
}

export class AutomationRule extends StubEntity {}
export class AuditLog extends StubEntity {}
export class CollectionDefinition extends StubEntity {}
export class PropertyDefinition extends StubEntity {}
export class AutomationExecutionLog extends StubEntity {}
export class InstanceEventOutbox extends StubEntity {}

export type AuditEvent = {
  userId?: string | null;
  collectionCode?: string | null;
  recordId?: string | null;
  action: string;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  permissionCode?: string | null;
};

export type AuditRecorder = (event: AuditEvent) => void;

// Match the real `withAudit` signature: open a transaction, hand the
// callback an EntityManager + a recorder, then flush the audit events on
// success. Tests provide a mock DataSource whose `transaction` honours
// rollback semantics.
export async function withAudit<T>(
  dataSource: { transaction: <R>(fn: (mgr: unknown) => Promise<R>) => Promise<R> },
  fn: (mgr: unknown, recordAudit: AuditRecorder) => Promise<T>,
): Promise<T> {
  return dataSource.transaction(async (mgr) => {
    const events: AuditEvent[] = [];
    const recorder: AuditRecorder = (e) => {
      events.push(e);
    };
    const result = await fn(mgr, recorder);
    if (events.length > 0) {
      const repo = (mgr as { getRepository: (e: unknown) => { create: (x: unknown) => unknown; save: (x: unknown[]) => Promise<unknown> } }).getRepository(AuditLog);
      const entries = events.map((e) => repo.create({ ...e }));
      await repo.save(entries);
    }
    return result;
  });
}

// Stub for the runtime-anomaly service. The real service writes structured
// anomaly events to a dedicated table; the stub no-ops so unit tests can
// assert call shape via jest mocks without dragging in TypeORM.
export interface RuntimeAnomalyEvent {
  kind: string;
  serviceCode: string;
  message: string;
  collectionCode?: string;
  recordId?: string;
  context?: Record<string, unknown>;
  error?: Error;
}

export class RuntimeAnomalyService {
  async record(_event: RuntimeAnomalyEvent): Promise<void> {
    // no-op stub
  }
}
