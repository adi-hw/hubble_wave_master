import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Add missing field types to support all UI field options.
 * This adds: text, integer, datetime, reference, multi_choice, multi_reference
 */
export class AddMissingFieldTypes1783000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO model_field_type (id, code, label, category, backend_type, ui_widget, validators, storage_config, flags, is_builtin)
      VALUES
        (gen_random_uuid(), 'text', 'Long Text', 'primitive', 'text', 'textarea', '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, true),
        (gen_random_uuid(), 'integer', 'Integer', 'primitive', 'integer', 'number', '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, true),
        (gen_random_uuid(), 'datetime', 'Date & Time', 'primitive', 'timestamptz', 'datetime', '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, true),
        (gen_random_uuid(), 'reference', 'Reference', 'reference', 'uuid', 'reference', '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, true),
        (gen_random_uuid(), 'multi_choice', 'Multi-Choice', 'choice', 'jsonb', 'multiselect', '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, true),
        (gen_random_uuid(), 'multi_reference', 'Multi-Reference', 'reference', 'jsonb', 'multi_reference', '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, true)
      ON CONFLICT (code) DO NOTHING;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM model_field_type
      WHERE code IN ('text', 'integer', 'datetime', 'reference', 'multi_choice', 'multi_reference');
    `);
  }
}
