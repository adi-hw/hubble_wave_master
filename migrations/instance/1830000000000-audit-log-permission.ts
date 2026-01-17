import { MigrationInterface, QueryRunner } from 'typeorm';

export class AuditLogPermission1830000000000 implements MigrationInterface {
  name = 'AuditLogPermission1830000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "audit_logs"
        ADD COLUMN IF NOT EXISTS "permission_code" varchar(100)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_audit_logs_permission_code_created_at"
        ON "audit_logs" ("permission_code", "created_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_audit_logs_permission_code_created_at"`);
    await queryRunner.query(`
      ALTER TABLE "audit_logs"
        DROP COLUMN IF EXISTS "permission_code"
    `);
  }
}
