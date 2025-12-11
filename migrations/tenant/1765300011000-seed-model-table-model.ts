import { MigrationInterface, QueryRunner } from "typeorm";

export class SeedModelTableModel1765300011000 implements MigrationInterface {
    name = 'SeedModelTableModel1765300011000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
          ALTER TABLE "model_table"
          ADD COLUMN IF NOT EXISTS "flags" jsonb NOT NULL DEFAULT '{}'::jsonb
        `);

        // Ensure needed field types exist
        await queryRunner.query(`
          INSERT INTO "model_field_type" (code, label, category, backend_type, ui_widget, validators, storage_config, flags)
          VALUES 
            ('text', 'Text', 'primitive', 'text', 'text', '{}'::jsonb, '{}'::jsonb, '{}'::jsonb),
            ('json', 'JSON', 'primitive', 'jsonb', 'json', '{}'::jsonb, '{}'::jsonb, '{}'::jsonb)
          ON CONFLICT (code) DO UPDATE
          SET label = EXCLUDED.label,
              category = EXCLUDED.category,
              backend_type = EXCLUDED.backend_type,
              ui_widget = EXCLUDED.ui_widget,
              updated_at = now()
        `);

        const tableRes = await queryRunner.query(`
          INSERT INTO "model_table" (code, label, category, storage_schema, storage_table, flags)
          VALUES ('model_table', 'Data Models', 'platform', 'public', 'model_table', '{}'::jsonb)
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
        const jsonRes = await queryRunner.query(`SELECT id FROM "model_field_type" WHERE code = 'json' LIMIT 1`);
        const textId = textRes[0]?.id;
        const jsonId = jsonRes[0]?.id;
        if (!textId || !jsonId) return;

        await queryRunner.query(`
          INSERT INTO "model_field" (table_id, field_type_id, code, label, nullable, is_unique, storage_path, config, display_order)
          VALUES
            ('${tableId}', '${textId}', 'code', 'Code', false, true, 'column:code', '{}'::jsonb, 1),
            ('${tableId}', '${textId}', 'label', 'Label', false, false, 'column:label', '{}'::jsonb, 2),
            ('${tableId}', '${textId}', 'category', 'Category', false, false, 'column:category', '{}'::jsonb, 3),
            ('${tableId}', '${textId}', 'storage_schema', 'Storage Schema', false, false, 'column:storage_schema', '{}'::jsonb, 4),
            ('${tableId}', '${textId}', 'storage_table', 'Storage Table', false, false, 'column:storage_table', '{}'::jsonb, 5),
            ('${tableId}', '${jsonId}', 'flags', 'Flags', true, false, 'column:flags', '{}'::jsonb, 6)
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
        await queryRunner.query(`DELETE FROM "model_field" WHERE table_id IN (SELECT id FROM "model_table" WHERE code = 'model_table')`);
        await queryRunner.query(`DELETE FROM "model_table" WHERE code = 'model_table'`);
        // Leave field types and flags column as they are useful elsewhere
    }
}
