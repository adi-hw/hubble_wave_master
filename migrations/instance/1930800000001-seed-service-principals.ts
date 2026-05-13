import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Seed the single service principal that backs the present
 * cross-process call surface per canon §29.7 — the BullMQ
 * background worker (`svc-worker`) calling back into the API
 * (`svc-api`).
 *
 * Founder direction: ONE row only. Do not seed `svc-api`, `svc-ava`,
 * `svc-insights`, `svc-sync`, etc. — those names appear as
 * documentation in canon §29.7 but no production code mints
 * tokens for them today. A row is added when a real call surface
 * emerges.
 *
 * Idempotent: the `ON CONFLICT (service_id) DO NOTHING` makes
 * re-running this migration safe in environments where the row
 * was already provisioned out-of-band.
 */
export class SeedServicePrincipals1930800000001 implements MigrationInterface {
  name = 'SeedServicePrincipals1930800000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "service_principals" (
        "service_id",
        "display_name",
        "allowed_audiences",
        "allowed_scopes",
        "k8s_service_account",
        "active"
      ) VALUES (
        'svc-worker',
        'BullMQ background worker',
        ARRAY['svc-api'],
        ARRAY['work_order:read', 'work_order:write', 'audit:write'],
        'system:serviceaccount:hubblewave-system:svc-worker-sa',
        true
      )
      ON CONFLICT ("service_id") DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "service_principals" WHERE "service_id" = 'svc-worker'`,
    );
  }
}
