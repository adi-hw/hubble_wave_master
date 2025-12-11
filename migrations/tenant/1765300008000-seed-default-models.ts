import { MigrationInterface, QueryRunner } from "typeorm";

export class SeedDefaultModels1765300008000 implements MigrationInterface {
    name = 'SeedDefaultModels1765300008000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
          CREATE TABLE IF NOT EXISTS "app_asset" (
            "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
            "serial_number" text,
            "status" text,
            "custom_data" jsonb NOT NULL DEFAULT '{}'::jsonb,
            "created_at" timestamptz NOT NULL DEFAULT now(),
            "updated_at" timestamptz NOT NULL DEFAULT now()
          )
        `);

        const textType = await queryRunner.query(`
          INSERT INTO "model_field_type" (code, label, category, backend_type, ui_widget, validators, storage_config, flags)
          VALUES ('text', 'Text', 'primitive', 'text', 'text', '{}'::jsonb, '{}'::jsonb, '{}'::jsonb)
          ON CONFLICT (code) DO UPDATE
          SET label = EXCLUDED.label,
              category = EXCLUDED.category,
              backend_type = EXCLUDED.backend_type,
              ui_widget = EXCLUDED.ui_widget,
              updated_at = now()
          RETURNING id;
        `);

        const statusType = await queryRunner.query(`
          INSERT INTO "model_field_type" (code, label, category, backend_type, ui_widget, validators, storage_config, flags)
          VALUES ('status', 'Status', 'choice', 'text', 'select', '{}'::jsonb, '{}'::jsonb, '{}'::jsonb)
          ON CONFLICT (code) DO UPDATE
          SET label = EXCLUDED.label,
              category = EXCLUDED.category,
              backend_type = EXCLUDED.backend_type,
              ui_widget = EXCLUDED.ui_widget,
              updated_at = now()
          RETURNING id;
        `);

        const jsonType = await queryRunner.query(`
          INSERT INTO "model_field_type" (code, label, category, backend_type, ui_widget, validators, storage_config, flags)
          VALUES ('json', 'JSON', 'primitive', 'jsonb', 'json', '{}'::jsonb, '{}'::jsonb, '{}'::jsonb)
          ON CONFLICT (code) DO UPDATE
          SET label = EXCLUDED.label,
              category = EXCLUDED.category,
              backend_type = EXCLUDED.backend_type,
              ui_widget = EXCLUDED.ui_widget,
              updated_at = now()
          RETURNING id;
        `);

        const tableRes = await queryRunner.query(`
          INSERT INTO "model_table" (code, label, category, storage_schema, storage_table, flags)
          VALUES ('asset', 'Asset', 'application', 'public', 'app_asset', '{}'::jsonb)
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

        const textId = textType[0]?.id;
        const statusId = statusType[0]?.id;
        const jsonId = jsonType[0]?.id;

        if (!textId || !statusId || !jsonId) return;

        await queryRunner.query(`
          INSERT INTO "model_field" (table_id, field_type_id, code, label, nullable, is_unique, default_value, storage_path, config, display_order)
          VALUES 
            ('${tableId}', '${textId}', 'serial_number', 'Serial Number', false, true, null, 'column:serial_number', '{}'::jsonb, 1),
            ('${tableId}', '${statusId}', 'status', 'Status', true, false, null, 'column:status', '{}'::jsonb, 2),
            ('${tableId}', '${jsonId}', 'custom_data', 'Custom Data', true, false, null, 'column:custom_data', '{}'::jsonb, 3)
          ON CONFLICT (table_id, code) DO UPDATE
          SET field_type_id = EXCLUDED.field_type_id,
              label = EXCLUDED.label,
              nullable = EXCLUDED.nullable,
              is_unique = EXCLUDED.is_unique,
              default_value = EXCLUDED.default_value,
              storage_path = EXCLUDED.storage_path,
              config = EXCLUDED.config,
              display_order = EXCLUDED.display_order,
              updated_at = now();
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DELETE FROM "model_field" WHERE table_id IN (SELECT id FROM "model_table" WHERE code = 'asset')`);
        await queryRunner.query(`DELETE FROM "model_table" WHERE code = 'asset'`);
        await queryRunner.query(`DROP TABLE IF EXISTS "app_asset"`);
        // Leave field types intact (may be used elsewhere)
    }
}
