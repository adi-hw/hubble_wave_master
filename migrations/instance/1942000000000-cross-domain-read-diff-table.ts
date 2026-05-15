import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * CrossDomainReadDiffTable1942000000000
 *
 * Creates `cross_domain_read_diff` in the `automation` schema. The table
 * records payload mismatches observed when a caller service compares its
 * primary DB read result against a cross-domain HTTP read for the same
 * record (cross-domain consistency diffing). Each row captures the caller,
 * callsite, lookup key, diff kind, and the delta payload.
 *
 * Operators query this table to assess cross-domain read consistency. Rows
 * with `diff_kind = 'value-mismatch'` require investigation; a sustained
 * period of zero new rows per `(caller_service, callsite)` pair indicates
 * the two read paths are in agreement.
 *
 * TTL-based archival is operator-driven; not enforced here. A simple
 * weekly cron (`DELETE FROM cross_domain_read_diff WHERE detected_at < now() - interval '90 days'`)
 * is the recommended cleanup pattern.
 */
export class CrossDomainReadDiffTable1942000000000
  implements MigrationInterface
{
  name = 'CrossDomainReadDiffTable1942000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Schema already exists (per W9 Phase C), but the IF NOT EXISTS
    // is defence-in-depth for fresh databases that haven't run
    // earlier migrations yet.
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS "automation"`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "automation"."cross_domain_read_diff" (
        "id" UUID NOT NULL DEFAULT gen_random_uuid(),
        "caller_service" VARCHAR(80) NOT NULL,
        "callsite" VARCHAR(200) NOT NULL,
        "lookup_key" VARCHAR(500) NOT NULL,
        "diff_kind" VARCHAR(50) NOT NULL,
        "delta" JSONB,
        "http_error" TEXT,
        "detected_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_cross_domain_read_diff" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_cross_domain_read_diff_kind"
          CHECK ("diff_kind" IN ('value-mismatch','db-only','http-only','http-error'))
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_cross_domain_read_diff_detected_at"
        ON "automation"."cross_domain_read_diff" ("detected_at")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_cross_domain_read_diff_caller_callsite_detected_at"
        ON "automation"."cross_domain_read_diff" ("caller_service", "callsite", "detected_at")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_cross_domain_read_diff_kind"
        ON "automation"."cross_domain_read_diff" ("diff_kind")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "automation"."IDX_cross_domain_read_diff_kind"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "automation"."IDX_cross_domain_read_diff_caller_callsite_detected_at"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "automation"."IDX_cross_domain_read_diff_detected_at"`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "automation"."cross_domain_read_diff"`,
    );
  }
}
