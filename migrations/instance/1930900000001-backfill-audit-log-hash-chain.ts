import { MigrationInterface, QueryRunner } from 'typeorm';
import {
  buildAuditLogHash,
  buildAuditLogHashPayload,
  AuditLog,
} from '@hubblewave/instance-db';

// MUST match `AUDIT_LOG_CHAIN_LOCK_KEY` exported by
// libs/instance-db/src/lib/subscribers/audit-log.subscriber.ts (canon §10).
// Inlined here because migrations live outside the library's relative-import
// scope, and adding a one-key barrel export risks merging conflict with
// concurrent PRs. The value is part of the database protocol — changing it
// would invalidate every chained audit row.
const AUDIT_LOG_CHAIN_LOCK_KEY = 'audit_log_hash_chain';

/**
 * Backfill `previous_hash` and `hash` columns on audit_logs rows that were
 * inserted before the audit-log subscriber existed, OR via raw SQL paths
 * that bypassed TypeORM subscribers.
 *
 * Idempotent: rows whose existing `hash` already equals the computed hash
 * for their payload + predecessor are skipped. Safe to re-run after a
 * partial failure.
 *
 * Acquires `pg_advisory_xact_lock(hashtext(AUDIT_LOG_CHAIN_LOCK_KEY))` per
 * the subscriber's lock convention so concurrent audit inserts cannot fork
 * the chain while the backfill runs. Lock auto-releases on commit/rollback.
 *
 * Canon §10 (auditability): every action explainable. A NULL hash means
 * the row's predecessor cannot be verified — exactly the integrity gap
 * this migration closes.
 */
export class BackfillAuditLogHashChain1930900000001
  implements MigrationInterface
{
  name = 'BackfillAuditLogHashChain1930900000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Acquire the chain-wide xact lock — same key the subscriber uses.
    // This serializes us against any concurrent audit writes for the full
    // duration of the migration transaction. On commit/rollback it releases
    // automatically (canon §10, F042).
    await queryRunner.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
      AUDIT_LOG_CHAIN_LOCK_KEY,
    ]);

    const BATCH = 10_000;
    let offset = 0;
    let previousHash: string | null = null;
    let totalProcessed = 0;
    let totalUpdated = 0;

    // Walk audit_logs in canonical order (createdAt ASC, id ASC) — the same
    // ordering the subscriber uses to find the predecessor row.
    while (true) {
      // TypeORM's QueryRunner returns timestamptz columns as JS Date objects,
      // so `created_at` arrives as a Date — which satisfies
      // buildAuditLogHashPayload's call to entry.createdAt.toISOString().
      const rows: Array<{
        id: string;
        user_id: string | null;
        collection_code: string | null;
        record_id: string | null;
        action: string;
        old_values: Record<string, unknown> | null;
        new_values: Record<string, unknown> | null;
        ip_address: string | null;
        user_agent: string | null;
        permission_code: string | null;
        created_at: Date;
        previous_hash: string | null;
        hash: string | null;
      }> = await queryRunner.query(
        `SELECT id, user_id, collection_code, record_id, action,
                old_values, new_values, ip_address, user_agent, permission_code,
                created_at, previous_hash, hash
         FROM audit_logs
         ORDER BY created_at ASC, id ASC
         LIMIT $1 OFFSET $2`,
        [BATCH, offset],
      );

      if (rows.length === 0) {
        break;
      }

      for (const row of rows) {
        totalProcessed++;

        // Build the entity-shaped plain object that buildAuditLogHashPayload
        // expects. The function accesses named properties (userId, collectionCode,
        // etc.) directly — duck-typing lets a plain object satisfy the AuditLog
        // parameter type. TypeORM returns Date for timestamptz, so
        // .toISOString() is available on created_at.
        const entity: Pick<
          AuditLog,
          | 'userId'
          | 'collectionCode'
          | 'recordId'
          | 'action'
          | 'oldValues'
          | 'newValues'
          | 'ipAddress'
          | 'userAgent'
          | 'permissionCode'
          | 'createdAt'
        > = {
          userId: row.user_id ?? null,
          collectionCode: row.collection_code ?? null,
          recordId: row.record_id ?? null,
          action: row.action,
          oldValues: row.old_values ?? null,
          newValues: row.new_values ?? null,
          ipAddress: row.ip_address ?? null,
          userAgent: row.user_agent ?? null,
          permissionCode: row.permission_code ?? null,
          createdAt: row.created_at,
        };

        const expectedHash = buildAuditLogHash(
          buildAuditLogHashPayload(entity as AuditLog, previousHash),
        );

        if (
          row.hash === expectedHash &&
          row.previous_hash === previousHash
        ) {
          // Already correct — chain is intact for this row.
          previousHash = expectedHash;
          continue;
        }

        await queryRunner.query(
          `UPDATE audit_logs SET previous_hash = $1, hash = $2 WHERE id = $3`,
          [previousHash, expectedHash, row.id],
        );

        totalUpdated++;
        previousHash = expectedHash;
      }

      // Progress log every BATCH rows so operators see status on large tables.
      if (totalProcessed % BATCH === 0) {
        console.log(
          `[BackfillAuditLogHashChain] processed=${totalProcessed} updated=${totalUpdated}`,
        );
      }

      offset += rows.length;
    }

    console.log(
      `[BackfillAuditLogHashChain] DONE processed=${totalProcessed} updated=${totalUpdated}`,
    );
  }

  public async down(): Promise<void> {
    // Intentionally no-op. The backfill is forward-only — reversing it
    // would re-introduce the §10 integrity gap. If you need to undo, set
    // hash/previous_hash to NULL via a separate ad-hoc migration AND
    // accept the deliberate audit-trail damage that entails.
  }
}
