import { MigrationInterface, QueryRunner } from 'typeorm';

export class EventOutbox1820000000002 implements MigrationInterface {
  name = 'EventOutbox1820000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "instance_event_outbox" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "event_type" varchar(120) NOT NULL,
        "collection_code" varchar(120),
        "record_id" uuid,
        "payload" jsonb NOT NULL,
        "status" varchar(16) NOT NULL DEFAULT 'pending',
        "attempts" int NOT NULL DEFAULT 0,
        "locked_at" timestamptz,
        "processed_at" timestamptz,
        "error_message" text,
        "created_at" timestamptz NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_instance_event_outbox_status_created_at"
      ON "instance_event_outbox" ("status", "created_at")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_instance_event_outbox_locked_at"
      ON "instance_event_outbox" ("locked_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_instance_event_outbox_locked_at"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_instance_event_outbox_status_created_at"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "instance_event_outbox"`);
  }
}
