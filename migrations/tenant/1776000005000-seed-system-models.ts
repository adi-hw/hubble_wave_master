import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Seed system models so built-in tables (model_table, model_field, modules) are browsable via the dynamic UI.
 */
export class SeedSystemModels1776000005000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Ensure field types exist (idempotent)
    await queryRunner.query(`
      INSERT INTO model_field_type (id, code, label, category, backend_type, ui_widget, validators, storage_config, flags, is_builtin)
      VALUES
        (gen_random_uuid(), 'string', 'String', 'primitive', 'text', 'text', '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, true),
        (gen_random_uuid(), 'number', 'Number', 'primitive', 'numeric', 'number', '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, true),
        (gen_random_uuid(), 'boolean', 'Boolean', 'primitive', 'boolean', 'checkbox', '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, true),
        (gen_random_uuid(), 'json', 'JSON', 'primitive', 'jsonb', 'json', '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, true)
      ON CONFLICT (code) DO NOTHING;
    `);

    // Helper CTE: get type ids
    const typeId = (code: string) => `(SELECT id FROM model_field_type WHERE code = '${code}')`;

    // Register model_table metadata
    await queryRunner.query(`
      WITH ins_model AS (
        INSERT INTO model_table (id, code, label, category, storage_schema, storage_table, flags)
        VALUES (gen_random_uuid(), 'model_table', 'Model Tables', 'system', 'public', 'model_table', '{}'::jsonb)
        ON CONFLICT (code) DO NOTHING
        RETURNING id
      ),
      model_row AS (
        SELECT id FROM ins_model
        UNION
        SELECT id FROM model_table WHERE code = 'model_table'
      )
      INSERT INTO model_field (id, table_id, field_type_id, code, label, nullable, is_unique, default_value, storage_path, config, display_order)
      VALUES
        (gen_random_uuid(), (SELECT id FROM model_row), ${typeId('string')}, 'code', 'Code', false, true, NULL, 'column:code', '{}'::jsonb, 0),
        (gen_random_uuid(), (SELECT id FROM model_row), ${typeId('string')}, 'label', 'Label', false, false, NULL, 'column:label', '{}'::jsonb, 1),
        (gen_random_uuid(), (SELECT id FROM model_row), ${typeId('string')}, 'category', 'Category', true, false, NULL, 'column:category', '{}'::jsonb, 2),
        (gen_random_uuid(), (SELECT id FROM model_row), ${typeId('string')}, 'storage_schema', 'Storage Schema', false, false, NULL, 'column:storage_schema', '{}'::jsonb, 3),
        (gen_random_uuid(), (SELECT id FROM model_row), ${typeId('string')}, 'storage_table', 'Storage Table', false, false, NULL, 'column:storage_table', '{}'::jsonb, 4),
        (gen_random_uuid(), (SELECT id FROM model_row), ${typeId('json')}, 'flags', 'Flags', true, false, NULL, 'column:flags', '{}'::jsonb, 5),
        (gen_random_uuid(), (SELECT id FROM model_row), ${typeId('string')}, 'created_at', 'Created At', true, false, NULL, 'column:created_at', '{}'::jsonb, 98),
        (gen_random_uuid(), (SELECT id FROM model_row), ${typeId('string')}, 'updated_at', 'Updated At', true, false, NULL, 'column:updated_at', '{}'::jsonb, 99)
      ON CONFLICT (table_id, code) DO NOTHING;
    `);

    // Register model_field metadata
    await queryRunner.query(`
      WITH ins_model AS (
        INSERT INTO model_table (id, code, label, category, storage_schema, storage_table, flags)
        VALUES (gen_random_uuid(), 'model_field', 'Model Fields', 'system', 'public', 'model_field', '{}'::jsonb)
        ON CONFLICT (code) DO NOTHING
        RETURNING id
      ),
      model_row AS (
        SELECT id FROM ins_model
        UNION
        SELECT id FROM model_table WHERE code = 'model_field'
      )
      INSERT INTO model_field (id, table_id, field_type_id, code, label, nullable, is_unique, default_value, storage_path, config, display_order)
      VALUES
        (gen_random_uuid(), (SELECT id FROM model_row), ${typeId('string')}, 'table_id', 'Table Id', false, false, NULL, 'column:table_id', '{}'::jsonb, 0),
        (gen_random_uuid(), (SELECT id FROM model_row), ${typeId('string')}, 'field_type_id', 'Field Type Id', false, false, NULL, 'column:field_type_id', '{}'::jsonb, 1),
        (gen_random_uuid(), (SELECT id FROM model_row), ${typeId('string')}, 'code', 'Code', false, false, NULL, 'column:code', '{}'::jsonb, 2),
        (gen_random_uuid(), (SELECT id FROM model_row), ${typeId('string')}, 'label', 'Label', false, false, NULL, 'column:label', '{}'::jsonb, 3),
        (gen_random_uuid(), (SELECT id FROM model_row), ${typeId('boolean')}, 'nullable', 'Nullable', false, false, NULL, 'column:nullable', '{}'::jsonb, 4),
        (gen_random_uuid(), (SELECT id FROM model_row), ${typeId('boolean')}, 'is_unique', 'Is Unique', false, false, NULL, 'column:is_unique', '{}'::jsonb, 5),
        (gen_random_uuid(), (SELECT id FROM model_row), ${typeId('string')}, 'default_value', 'Default Value', true, false, NULL, 'column:default_value', '{}'::jsonb, 6),
        (gen_random_uuid(), (SELECT id FROM model_row), ${typeId('string')}, 'storage_path', 'Storage Path', false, false, NULL, 'column:storage_path', '{}'::jsonb, 7),
        (gen_random_uuid(), (SELECT id FROM model_row), ${typeId('json')}, 'config', 'Config', true, false, NULL, 'column:config', '{}'::jsonb, 8),
        (gen_random_uuid(), (SELECT id FROM model_row), ${typeId('number')}, 'display_order', 'Display Order', true, false, NULL, 'column:display_order', '{}'::jsonb, 9),
        (gen_random_uuid(), (SELECT id FROM model_row), ${typeId('string')}, 'created_at', 'Created At', true, false, NULL, 'column:created_at', '{}'::jsonb, 98),
        (gen_random_uuid(), (SELECT id FROM model_row), ${typeId('string')}, 'updated_at', 'Updated At', true, false, NULL, 'column:updated_at', '{}'::jsonb, 99)
      ON CONFLICT (table_id, code) DO NOTHING;
    `);

    // Register modules metadata (so /modules.list can work if desired)
    await queryRunner.query(`
      WITH ins_model AS (
        INSERT INTO model_table (id, code, label, category, storage_schema, storage_table, flags)
        VALUES (gen_random_uuid(), 'modules', 'Modules', 'system', 'public', 'modules', '{}'::jsonb)
        ON CONFLICT (code) DO NOTHING
        RETURNING id
      ),
      model_row AS (
        SELECT id FROM ins_model
        UNION
        SELECT id FROM model_table WHERE code = 'modules'
      )
      INSERT INTO model_field (id, table_id, field_type_id, code, label, nullable, is_unique, default_value, storage_path, config, display_order)
      VALUES
        (gen_random_uuid(), (SELECT id FROM model_row), ${typeId('string')}, 'name', 'Name', false, false, NULL, 'column:name', '{}'::jsonb, 0),
        (gen_random_uuid(), (SELECT id FROM model_row), ${typeId('string')}, 'slug', 'Slug', false, true, NULL, 'column:slug', '{}'::jsonb, 1),
        (gen_random_uuid(), (SELECT id FROM model_row), ${typeId('string')}, 'route', 'Route', true, false, NULL, 'column:route', '{}'::jsonb, 2),
        (gen_random_uuid(), (SELECT id FROM model_row), ${typeId('string')}, 'category', 'Category', true, false, NULL, 'column:category', '{}'::jsonb, 3),
        (gen_random_uuid(), (SELECT id FROM model_row), ${typeId('number')}, 'sort_order', 'Sort Order', true, false, NULL, 'column:sort_order', '{}'::jsonb, 4),
        (gen_random_uuid(), (SELECT id FROM model_row), ${typeId('string')}, 'created_at', 'Created At', true, false, NULL, 'column:created_at', '{}'::jsonb, 98),
        (gen_random_uuid(), (SELECT id FROM model_row), ${typeId('string')}, 'updated_at', 'Updated At', true, false, NULL, 'column:updated_at', '{}'::jsonb, 99)
      ON CONFLICT (table_id, code) DO NOTHING;
    `);

    // Seed a nav-friendly module for Tables (optional discovery)
    await queryRunner.query(`
      INSERT INTO modules (id, name, slug, description, route, icon, category, sort_order)
      VALUES (
        gen_random_uuid(),
        'Tables',
        'tables',
        'Manage data models',
        '/tables',
        'Table2',
        'System',
        5
      )
      ON CONFLICT (slug) DO NOTHING;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM modules WHERE slug IN ('tables');`);
    await queryRunner.query(`DELETE FROM model_field WHERE table_id IN (SELECT id FROM model_table WHERE code IN ('modules','model_field','model_table'));`);
    await queryRunner.query(`DELETE FROM model_table WHERE code IN ('modules','model_field','model_table');`);
    await queryRunner.query(`DELETE FROM model_field_type WHERE code IN ('string','number','boolean','json');`);
  }
}
