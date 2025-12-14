import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Safety migration to ensure the "permissions" column exists on the roles table.
 * Some environments were provisioned without this column, causing login queries
 * that join roles to fail with "column ... permissions does not exist".
 */
export class AddRolePermissionsColumn1764800000000 implements MigrationInterface {
  name = 'AddRolePermissionsColumn1764800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Only alter if the legacy roles table exists
    const tableExists = await queryRunner.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'roles'
      )
    `);
    if (tableExists?.[0]?.exists) {
      await queryRunner.query(`
        ALTER TABLE "roles"
        ADD COLUMN IF NOT EXISTS "permissions" text NOT NULL DEFAULT ''
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Only alter if the legacy roles table exists
    const tableExists = await queryRunner.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'roles'
      )
    `);
    if (tableExists?.[0]?.exists) {
      await queryRunner.query(`
        ALTER TABLE "roles"
        DROP COLUMN IF EXISTS "permissions"
      `);
    }
  }
}
