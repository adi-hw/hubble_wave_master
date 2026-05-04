import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Backfill `definition_owner_id` on existing metric_definitions rows so the
 * scheduled rollup loop in svc-insights stops silently skipping them.
 *
 * Wave 3 added the column and made the rollup runner refuse to evaluate a
 * metric with no owner — the design rationale being that the rollup must
 * impersonate a real user whose row-level permissions bound the aggregate,
 * preventing fact-leakage via aggregate counts. Any pre-existing seeded
 * metric must therefore be assigned an owner before the next rollup tick.
 *
 * Strategy: ensure a dedicated `platform-rollup@hubblewave.local` system
 * user exists in this instance, then backfill that user's id into every
 * metric_definitions row whose `definition_owner_id IS NULL`. Idempotent —
 * re-running the migration is a no-op once both the user exists and every
 * row is owned.
 *
 * Operationally the platform-rollup user has no role assignments and no
 * password, so it cannot be impersonated interactively; its only purpose is
 * to give the rollup loop a stable userId to bind audit records to. If a
 * specific metric should aggregate against a richer permission set (e.g.,
 * an EAM "incidents created" metric scoped to maintenance roles), the
 * dashboard owner should set `definition_owner_id` explicitly via the
 * metrics admin UI; this backfill only repairs unowned rows.
 */
export class BackfillMetricDefinitionOwner1832000000000 implements MigrationInterface {
  name = 'BackfillMetricDefinitionOwner1832000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const serviceEmail = 'platform-rollup@hubblewave.local';

    const existing = await queryRunner.query(
      `SELECT id FROM users WHERE email = $1 AND deleted_at IS NULL LIMIT 1`,
      [serviceEmail],
    );

    let serviceUserId: string;
    if (existing && existing.length > 0) {
      serviceUserId = existing[0].id;
    } else {
      const inserted = await queryRunner.query(
        `INSERT INTO users (
          id, email, display_name, first_name, last_name,
          status, is_admin, is_system_user, email_verified,
          created_at, updated_at
        ) VALUES (
          uuid_generate_v4(), $1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW()
        ) RETURNING id`,
        [
          serviceEmail,
          'Platform Rollup Service',
          'Platform',
          'Rollup',
          'active',
          false,
          true,
          true,
        ],
      );
      serviceUserId = inserted[0]?.id;
      if (!serviceUserId) {
        throw new Error('Failed to create platform-rollup service user');
      }
    }

    await queryRunner.query(
      `UPDATE metric_definitions
          SET definition_owner_id = $1
        WHERE definition_owner_id IS NULL`,
      [serviceUserId],
    );
  }

  public async down(): Promise<void> {
    // Intentionally no-op: backfilled ownership is not destructive, and the
    // service-account user is referenced by audit rows that must outlive a
    // schema rollback. The forward migration is idempotent, so reapplying is
    // safe; reverting would orphan audit history without recovering anything
    // useful.
  }
}
