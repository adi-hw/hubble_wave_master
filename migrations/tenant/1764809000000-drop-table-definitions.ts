import { MigrationInterface, QueryRunner } from "typeorm";

export class DropTableDefinitions1764809000000 implements MigrationInterface {
    name = 'DropTableDefinitions1764809000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Check if model_form_layout exists before altering
        const tableExists = await queryRunner.query(`
          SELECT EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = 'model_form_layout'
          )
        `);

        if (tableExists?.[0]?.exists) {
            // Drop FK from model_form_layout to table_definitions
            await queryRunner.query(`ALTER TABLE "model_form_layout" DROP CONSTRAINT IF EXISTS "model_form_layout_tableId_fkey"`);
            await queryRunner.query(`ALTER TABLE "model_form_layout" DROP CONSTRAINT IF EXISTS "FK_ef968475e513c7d117771a5736e"`);

            // Drop legacy table_definitions
            await queryRunner.query(`DROP TABLE IF EXISTS "table_definitions"`);

            // Remove catalog entry if it exists
            await queryRunner.query(`DELETE FROM "model_table" WHERE code = 'table_definitions'`);

            // Reattach FK to model_table
            await queryRunner.query(`
              ALTER TABLE "model_form_layout"
              ADD CONSTRAINT "FK_model_form_layout_model_table"
              FOREIGN KEY ("tableId") REFERENCES "model_table"("id")
              ON DELETE CASCADE ON UPDATE NO ACTION
            `);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Remove FK to model_table
        await queryRunner.query(`ALTER TABLE "model_form_layout" DROP CONSTRAINT IF EXISTS "FK_model_form_layout_model_table"`);

        // Recreate table_definitions minimally
        await queryRunner.query(`
          CREATE TABLE IF NOT EXISTS "table_definitions" (
            "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
            "tableName" text UNIQUE NOT NULL,
            "displayName" text NOT NULL,
            "fields" jsonb NOT NULL DEFAULT '[]',
            "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
            "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
          )
        `);

        // Restore FK to table_definitions
        await queryRunner.query(`
          ALTER TABLE "model_form_layout"
          ADD CONSTRAINT "FK_ef968475e513c7d117771a5736e"
          FOREIGN KEY ("tableId") REFERENCES "table_definitions"("id")
          ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    }
}
