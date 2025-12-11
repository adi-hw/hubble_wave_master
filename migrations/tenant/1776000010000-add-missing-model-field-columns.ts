import { MigrationInterface, QueryRunner } from "typeorm";

export class AddMissingModelFieldColumns1776000010000 implements MigrationInterface {
    name = 'AddMissingModelFieldColumns1776000010000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add is_internal column if it doesn't exist
        await queryRunner.query(`
            ALTER TABLE "model_field"
            ADD COLUMN IF NOT EXISTS "is_internal" boolean NOT NULL DEFAULT false
        `);

        // Add show_in_forms column if it doesn't exist
        await queryRunner.query(`
            ALTER TABLE "model_field"
            ADD COLUMN IF NOT EXISTS "show_in_forms" boolean NOT NULL DEFAULT true
        `);

        // Add show_in_lists column if it doesn't exist
        await queryRunner.query(`
            ALTER TABLE "model_field"
            ADD COLUMN IF NOT EXISTS "show_in_lists" boolean NOT NULL DEFAULT true
        `);

        // Add is_system column if it doesn't exist (already has select: false in entity but good to have)
        await queryRunner.query(`
            ALTER TABLE "model_field"
            ADD COLUMN IF NOT EXISTS "is_system" boolean DEFAULT false
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // We don't drop columns in down migration to preserve data
        // If you really need to rollback, uncomment:
        // await queryRunner.query(`ALTER TABLE "model_field" DROP COLUMN IF EXISTS "is_internal"`);
        // await queryRunner.query(`ALTER TABLE "model_field" DROP COLUMN IF EXISTS "show_in_forms"`);
        // await queryRunner.query(`ALTER TABLE "model_field" DROP COLUMN IF EXISTS "show_in_lists"`);
        // await queryRunner.query(`ALTER TABLE "model_field" DROP COLUMN IF EXISTS "is_system"`);
    }
}
