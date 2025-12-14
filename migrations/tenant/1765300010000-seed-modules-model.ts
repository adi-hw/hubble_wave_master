import { MigrationInterface, QueryRunner } from "typeorm";

export class SeedModulesModel1765300010000 implements MigrationInterface {
    name = 'SeedModulesModel1765300010000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add snake_case columns if they don't exist
        await queryRunner.query(`
          ALTER TABLE "modules"
          ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP NOT NULL DEFAULT now(),
          ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP NOT NULL DEFAULT now()
        `);
        // Migrate from camelCase if columns exist (legacy schema)
        const hasCreatedAt = await queryRunner.query(`
          SELECT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'modules' AND column_name = 'createdAt'
          )
        `);
        if (hasCreatedAt?.[0]?.exists) {
          await queryRunner.query(`UPDATE "modules" SET created_at = COALESCE(created_at, "createdAt")`);
          await queryRunner.query(`UPDATE "modules" SET updated_at = COALESCE(updated_at, "updatedAt")`);
        }

        // Ensure field types include integer
        await queryRunner.query(`
          INSERT INTO "model_field_type" (code, label, category, backend_type, ui_widget, validators, storage_config, flags)
          VALUES ('integer', 'Integer', 'primitive', 'integer', 'number', '{}'::jsonb, '{}'::jsonb, '{}'::jsonb)
          ON CONFLICT (code) DO UPDATE
          SET label = EXCLUDED.label,
              category = EXCLUDED.category,
              backend_type = EXCLUDED.backend_type,
              ui_widget = EXCLUDED.ui_widget,
              updated_at = now()
        `);

        const tableRes = await queryRunner.query(`
          INSERT INTO "model_table" (code, label, category, storage_schema, storage_table, flags)
          VALUES ('modules', 'Modules', 'platform', 'public', 'modules', '{}'::jsonb)
          ON CONFLICT (code) DO UPDATE
          SET label = EXCLUDED.label,
              category = EXCLUDED.category,
              storage_schema = EXCLUDED.storage_schema,
              storage_table = EXCLUDED.storage_table,
              updated_at = now()
          RETURNING id;
        `);
        const tableId = tableRes[0]?.id;
        if (!tableId) return;

        const textRes = await queryRunner.query(`SELECT id FROM "model_field_type" WHERE code = 'text' LIMIT 1`);
        const intRes = await queryRunner.query(`SELECT id FROM "model_field_type" WHERE code = 'integer' LIMIT 1`);
        const textId = textRes[0]?.id;
        const intId = intRes[0]?.id;
        if (!textId || !intId) return;

        await queryRunner.query(`
          INSERT INTO "model_field" (table_id, field_type_id, code, label, nullable, is_unique, storage_path, config, display_order)
          VALUES
            ('${tableId}', '${textId}', 'name', 'Name', false, false, 'column:name', '{}'::jsonb, 1),
            ('${tableId}', '${textId}', 'slug', 'Slug', false, true, 'column:slug', '{}'::jsonb, 2),
            ('${tableId}', '${textId}', 'description', 'Description', true, false, 'column:description', '{}'::jsonb, 3),
            ('${tableId}', '${textId}', 'route', 'Route', true, false, 'column:route', '{}'::jsonb, 4),
            ('${tableId}', '${textId}', 'icon', 'Icon', true, false, 'column:icon', '{}'::jsonb, 5),
            ('${tableId}', '${textId}', 'category', 'Category', true, false, 'column:category', '{}'::jsonb, 6),
            ('${tableId}', '${intId}', 'sortOrder', 'Sort Order', false, false, 'column:sortOrder', '{}'::jsonb, 7)
          ON CONFLICT (table_id, code) DO UPDATE
          SET field_type_id = EXCLUDED.field_type_id,
              label = EXCLUDED.label,
              nullable = EXCLUDED.nullable,
              is_unique = EXCLUDED.is_unique,
              storage_path = EXCLUDED.storage_path,
              config = EXCLUDED.config,
              display_order = EXCLUDED.display_order,
              updated_at = now();
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DELETE FROM "model_field" WHERE table_id IN (SELECT id FROM "model_table" WHERE code = 'modules')`);
        await queryRunner.query(`DELETE FROM "model_table" WHERE code = 'modules'`);
        // Keep created_at/updated_at columns and integer field type as they are generally useful
    }
}
