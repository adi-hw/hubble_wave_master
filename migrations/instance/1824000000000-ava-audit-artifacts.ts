import { MigrationInterface, QueryRunner } from 'typeorm';

export class AvaAuditArtifacts1824000000000 implements MigrationInterface {
  name = 'AvaAuditArtifacts1824000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE ava_audit_trail
        ADD COLUMN IF NOT EXISTS suggested_actions JSONB,
        ADD COLUMN IF NOT EXISTS preview_payload JSONB,
        ADD COLUMN IF NOT EXISTS approval_payload JSONB,
        ADD COLUMN IF NOT EXISTS execution_payload JSONB
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE ava_audit_trail
        DROP COLUMN IF EXISTS execution_payload,
        DROP COLUMN IF EXISTS approval_payload,
        DROP COLUMN IF EXISTS preview_payload,
        DROP COLUMN IF EXISTS suggested_actions
    `);
  }
}
