import { EventSubscriber, EntitySubscriberInterface, InsertEvent } from 'typeorm';
import { AuditLog } from '../entities/settings.entity';
import { buildAuditLogHash, buildAuditLogHashPayload } from '../audit-log-hash';

/**
 * Stable key used to derive the audit-log chain advisory-lock id.
 *
 * Exported so the spec suite can assert that the subscriber issues
 * `pg_advisory_xact_lock` against this exact key before reading the
 * predecessor row. Changing this key invalidates the serialization
 * guarantee for all concurrent audit writes (canon §10, F042).
 */
export const AUDIT_LOG_CHAIN_LOCK_KEY = 'audit_log_hash_chain';

@EventSubscriber()
export class AuditLogSubscriber implements EntitySubscriberInterface<AuditLog> {
  listenTo() {
    return AuditLog;
  }

  /**
   * Compute the per-row hash linking this audit entry to its predecessor.
   *
   * Canon §10 ("every action must be explainable") requires the audit chain
   * to remain a single linear sequence. Without serialization, two concurrent
   * inserts can both read the same predecessor `hash` and both write rows
   * pointing back to it — forking the chain and silently breaking integrity
   * (audit finding F042).
   *
   * Fix (Option A, advisory xact lock): every audit insert acquires
   * `pg_advisory_xact_lock(hashtext(AUDIT_LOG_CHAIN_LOCK_KEY))` first. The
   * lock is held until the surrounding transaction commits or rolls back —
   * so concurrent inserters block here, read the freshly-committed
   * predecessor when their turn comes, and produce a single continuous
   * chain. On rollback the lock releases too, so an aborted audit write
   * cannot leave a stuck lock.
   *
   * Tradeoff: audit writes serialize across the whole chain. That is the
   * correct posture — auditability is not a perf-critical write path, and
   * the canon requires chain integrity, not throughput.
   */
  async beforeInsert(event: InsertEvent<AuditLog>): Promise<void> {
    // Acquire the chain-wide xact lock BEFORE reading the predecessor row.
    // Releases automatically on commit/rollback (canon §10, F042).
    await event.queryRunner.query(
      'SELECT pg_advisory_xact_lock(hashtext($1))',
      [AUDIT_LOG_CHAIN_LOCK_KEY],
    );

    const repository = event.manager.getRepository(AuditLog);
    const last = await repository
      .createQueryBuilder('audit')
      .select(['audit.hash'])
      .orderBy('audit.createdAt', 'DESC')
      .addOrderBy('audit.id', 'DESC')
      .limit(1)
      .getOne();

    const previousHash = last?.hash || null;

    if (!event.entity.createdAt) {
      event.entity.createdAt = new Date();
    }

    event.entity.previousHash = previousHash;
    event.entity.hash = buildAuditLogHash(
      buildAuditLogHashPayload(event.entity, previousHash),
    );
  }
}
