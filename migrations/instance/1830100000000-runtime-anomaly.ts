import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * W2.D — Create the runtime_anomaly table.
 *
 * Captures structured records of runtime conditions the platform tolerated
 * rather than failed on (bulk partial skips, swallowed after-automation
 * errors, terminal outbox drops, etc.). Anomaly writes happen outside the
 * surrounding business transaction so they survive a rollback.
 */
export class RuntimeAnomaly1830100000000 implements MigrationInterface {
  name = 'RuntimeAnomaly1830100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "runtime_anomaly" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "kind" varchar(80) NOT NULL,
        "service_code" varchar(80) NOT NULL,
        "collection_code" varchar(120),
        "record_id" varchar(120),
        "message" text NOT NULL,
        "context" jsonb,
        "error_payload" jsonb,
        "occurred_at" timestamptz NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_runtime_anomaly_kind_occurred_at"
        ON "runtime_anomaly" ("kind", "occurred_at")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_runtime_anomaly_service_occurred_at"
        ON "runtime_anomaly" ("service_code", "occurred_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_runtime_anomaly_service_occurred_at"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_runtime_anomaly_kind_occurred_at"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "runtime_anomaly"`);
  }
}
