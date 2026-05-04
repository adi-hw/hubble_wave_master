import { DataSource, EntityManager } from 'typeorm';
import { AuditLog } from '../entities/settings.entity';

/**
 * Audit event recorded inside a `withAudit` transaction.
 *
 * Mirrors the persisted columns of the `audit_logs` table so the recorded
 * event can be saved verbatim. All optional fields default to `null` when
 * persisted.
 */
export interface AuditEvent {
  userId?: string | null;
  collectionCode?: string | null;
  recordId?: string | null;
  action: string;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  permissionCode?: string | null;
}

/**
 * Callback used inside a `withAudit` block to record an audit event without
 * dispatching the database write directly. The actual write is performed by
 * `withAudit` itself, after the wrapped operation completes successfully.
 */
export type AuditRecorder = (event: AuditEvent) => void;

/**
 * Run a state-changing operation that writes both data and audit row(s)
 * inside a single database transaction.
 *
 * The operation receives a transactional `EntityManager` and a `recordAudit`
 * callback. The audit rows are flushed only after the wrapped function
 * resolves. If anything throws (data write, audit write, or an explicit
 * `throw`), the transaction rolls back and neither the data nor the audit
 * rows are persisted.
 *
 * Canon §10 ("every action must be explainable"): a record mutation and its
 * audit log entry must succeed together or fail together — never one without
 * the other.
 */
export async function withAudit<T>(
  dataSource: DataSource,
  fn: (mgr: EntityManager, recordAudit: AuditRecorder) => Promise<T>,
): Promise<T> {
  return dataSource.transaction(async (mgr) => {
    const auditEvents: AuditEvent[] = [];
    const recordAudit: AuditRecorder = (event) => {
      auditEvents.push(event);
    };

    const result = await fn(mgr, recordAudit);

    if (auditEvents.length > 0) {
      const repo = mgr.getRepository(AuditLog);
      const entries = auditEvents.map((event) =>
        repo.create({
          userId: event.userId ?? null,
          collectionCode: event.collectionCode ?? null,
          recordId: event.recordId ?? null,
          action: event.action,
          oldValues: event.oldValues ?? null,
          newValues: event.newValues ?? null,
          ipAddress: event.ipAddress ?? null,
          userAgent: event.userAgent ?? null,
          permissionCode: event.permissionCode ?? null,
        }),
      );
      await repo.save(entries);
    }

    return result;
  });
}
