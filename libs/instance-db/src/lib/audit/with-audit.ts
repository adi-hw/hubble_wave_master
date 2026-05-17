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
 *
 * Plan Fix 41 / F042 — audit events are flushed as **individually chained
 * inserts**, one `await repo.save(entry)` per recorded event, NOT a single
 * `repo.save([...])` array call. The reason is the hash chain extension
 * path in `AuditLogSubscriber.beforeInsert`: TypeORM's `SubjectExecutor`
 * runs the `beforeInsert` hook for EVERY subject in a batched save before
 * any INSERT fires (`node_modules/typeorm/persistence/SubjectExecutor.js`).
 * The advisory lock the subscriber acquires is re-entrant on the same
 * Postgres backend, so all N entries in a batched save read the same
 * predecessor row and produce N rows forking off one ancestor — the F042
 * fork pattern. Sequential per-row saves serialize the chain extension
 * inside the wrapping transaction; the lock continues to do its
 * inter-transaction job correctly.
 *
 * Canon §10 amendment (2026-05-16, Plan Fix 41): audit hash-chain writes
 * must be linearized at the insert boundary. TypeORM array saves of
 * `AuditLog` are forbidden unless a future DB-native chain writer
 * computes both `previous_hash` and `hash` atomically. The
 * `audit:check` scanner enforces this at the repo-level surface.
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
      // Sequential per-row saves: each call triggers its own beforeInsert
      // hook → its own advisory-lock-guarded predecessor read → its own
      // INSERT, with the chain extending one row at a time. Array saves
      // would batch the beforeInsert hooks and fork the chain (F042).
      for (const event of auditEvents) {
        const entry = repo.create({
          userId: event.userId ?? null,
          collectionCode: event.collectionCode ?? null,
          recordId: event.recordId ?? null,
          action: event.action,
          oldValues: event.oldValues ?? null,
          newValues: event.newValues ?? null,
          ipAddress: event.ipAddress ?? null,
          userAgent: event.userAgent ?? null,
          permissionCode: event.permissionCode ?? null,
        });
        await repo.save(entry);
      }
    }

    return result;
  });
}
