import { MigrationInterface, QueryRunner } from "typeorm";

export class DropTenantIdModules1764812000000 implements MigrationInterface {
    name = 'DropTenantIdModules1764812000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Drop legacy unique constraint if present
        await queryRunner.query(`ALTER TABLE "modules" DROP CONSTRAINT IF EXISTS "uq_modules_tenant_slug"`);
        await queryRunner.query(`ALTER TABLE "modules" DROP CONSTRAINT IF EXISTS "modules_tenantid_slug_key"`);
        await queryRunner.query(`ALTER TABLE "modules" DROP CONSTRAINT IF EXISTS "modules_tenantid_slug_idx"`);

        // Drop tenantId column
        await queryRunner.query(`ALTER TABLE "modules" DROP COLUMN IF EXISTS "tenantId"`);

        // Add unique constraint on slug only
        await queryRunner.query(`ALTER TABLE "modules" ADD CONSTRAINT "uq_modules_slug" UNIQUE ("slug")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Remove slug-only constraint
        await queryRunner.query(`ALTER TABLE "modules" DROP CONSTRAINT IF EXISTS "uq_modules_slug"`);

        // Re-add tenantId and unique with tenantId, slug
        await queryRunner.query(`ALTER TABLE "modules" ADD COLUMN IF NOT EXISTS "tenantId" uuid NULL`);
        await queryRunner.query(`ALTER TABLE "modules" ADD CONSTRAINT "uq_modules_tenant_slug" UNIQUE ("tenantId", "slug")`);
    }
}
