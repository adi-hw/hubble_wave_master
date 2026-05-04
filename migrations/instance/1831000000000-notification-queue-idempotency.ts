import { MigrationInterface, QueryRunner } from 'typeorm';

export class NotificationQueueIdempotency1831000000000 implements MigrationInterface {
  name = 'NotificationQueueIdempotency1831000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "notification_queue"
        ADD COLUMN IF NOT EXISTS "idempotency_key" varchar(64)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_notification_queue_idempotency_key"
        ON "notification_queue" ("idempotency_key")
        WHERE "idempotency_key" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_notification_queue_idempotency_key"`);
    await queryRunner.query(`
      ALTER TABLE "notification_queue"
        DROP COLUMN IF EXISTS "idempotency_key"
    `);
  }
}
