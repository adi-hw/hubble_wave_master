import { MigrationInterface, QueryRunner } from 'typeorm';

export class AuditLogHashChain1820000000001 implements MigrationInterface {
  name = 'AuditLogHashChain1820000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "audit_logs"
        ADD COLUMN IF NOT EXISTS "previous_hash" varchar(64),
        ADD COLUMN IF NOT EXISTS "hash" varchar(64)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_audit_logs_hash" ON "audit_logs" ("hash")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_audit_logs_previous_hash" ON "audit_logs" ("previous_hash")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_audit_logs_previous_hash"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_audit_logs_hash"`);
    await queryRunner.query(`
      ALTER TABLE "audit_logs"
        DROP COLUMN IF EXISTS "hash",
        DROP COLUMN IF EXISTS "previous_hash"
    `);
  }
}
