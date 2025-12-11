import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Seed baseline metadata so dynamic modules have working models.
 * - Inserts built-in field types.
 * - Registers the asset model mapped to the physical app_asset table.
 * - Seeds a basic "Assets" module so navigation has a real destination.
 */
export class SeedTenantMetadata1776000004000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Seed field types
    await queryRunner.query(`
      INSERT INTO model_field_type (id, code, label, category, backend_type, ui_widget, validators, storage_config, flags, is_builtin)
      VALUES
        (gen_random_uuid(), 'string', 'String', 'primitive', 'text', 'text', '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, true),
        (gen_random_uuid(), 'number', 'Number', 'primitive', 'numeric', 'number', '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, true),
        (gen_random_uuid(), 'boolean', 'Boolean', 'primitive', 'boolean', 'checkbox', '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, true),
        (gen_random_uuid(), 'date', 'Date/Time', 'primitive', 'timestamptz', 'date', '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, true),
        (gen_random_uuid(), 'choice', 'Choice', 'choice', 'text', 'select', '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, true),
        (gen_random_uuid(), 'json', 'JSON', 'primitive', 'jsonb', 'json', '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, true)
      ON CONFLICT (code) DO NOTHING;
    `);

    // Seed asset model mapped to existing app_asset table
    await queryRunner.query(`
      WITH ins_model AS (
        INSERT INTO model_table (id, code, label, category, storage_schema, storage_table, flags)
        VALUES (gen_random_uuid(), 'asset', 'Asset', 'application', 'public', 'app_asset', '{}'::jsonb)
        ON CONFLICT (code) DO NOTHING
        RETURNING id
      ),
      model_row AS (
        SELECT id FROM ins_model
        UNION
        SELECT id FROM model_table WHERE code = 'asset'
      ),
      ftypes AS (
        SELECT code, id FROM model_field_type
      )
      INSERT INTO model_field (id, table_id, field_type_id, code, label, nullable, is_unique, default_value, storage_path, config, display_order)
      SELECT gen_random_uuid(), (SELECT id FROM model_row), ft.id, mf.code, mf.label, mf.nullable, mf.is_unique, mf.default_value, mf.storage_path, mf.config, mf.display_order
      FROM (
        VALUES
          ('serial_number', 'Serial Number', false, true, NULL, 'column:serial_number', '{}'::jsonb, 0),
          ('status', 'Status', true, false, NULL, 'column:status', '{}'::jsonb, 1),
          ('custom_data', 'Custom Data', true, false, NULL, 'column:custom_data', '{}'::jsonb, 2)
      ) AS mf(code, label, nullable, is_unique, default_value, storage_path, config, display_order)
      JOIN ftypes ft ON (
        CASE mf.code
          WHEN 'custom_data' THEN 'json'
          ELSE 'string'
        END
      ) = ft.code
      ON CONFLICT (table_id, code) DO NOTHING;
    `);

    // Seed a basic module pointing to assets
    await queryRunner.query(`
      INSERT INTO modules (id, name, slug, description, route, icon, category, sort_order)
      VALUES (
        gen_random_uuid(),
        'Assets',
        'assets',
        'Manage assets',
        '/assets',
        'Package',
        'Operations',
        10
      )
      ON CONFLICT (slug) DO NOTHING;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM modules WHERE slug IN ('assets');`);
    await queryRunner.query(`DELETE FROM model_field WHERE code IN ('serial_number', 'status', 'custom_data') AND table_id IN (SELECT id FROM model_table WHERE code = 'asset');`);
    await queryRunner.query(`DELETE FROM model_table WHERE code = 'asset';`);
    await queryRunner.query(`DELETE FROM model_field_type WHERE code IN ('string', 'number', 'boolean', 'date', 'choice', 'json');`);
  }
}
