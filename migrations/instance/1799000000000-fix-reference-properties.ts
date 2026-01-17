import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Fix reference property configurations
 *
 * This migration updates property_definitions to have proper reference_collection_id
 * and reference_display_property values for reference-type fields.
 */
export class FixReferenceProperties1799000000000 implements MigrationInterface {
  name = 'FixReferenceProperties1799000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Update collection_id property on property_definitions collection
    // Note: collection code is 'property_definitions' not 'properties'
    await queryRunner.query(`
      UPDATE property_definitions pd
      SET
        reference_collection_id = (SELECT id FROM collection_definitions WHERE code = 'collection_definitions' LIMIT 1),
        reference_display_property = 'name'
      WHERE pd.code = 'collection_id'
        AND pd.collection_id = (SELECT id FROM collection_definitions WHERE code = 'property_definitions' LIMIT 1)
        AND pd.reference_collection_id IS NULL
    `);

    // Update parent_role_id property on roles collection
    await queryRunner.query(`
      UPDATE property_definitions pd
      SET
        reference_collection_id = (SELECT id FROM collection_definitions WHERE code = 'roles' LIMIT 1),
        reference_display_property = 'name'
      WHERE pd.code = 'parent_role_id'
        AND pd.collection_id = (SELECT id FROM collection_definitions WHERE code = 'roles' LIMIT 1)
        AND pd.reference_collection_id IS NULL
    `);

    // Update parent_group_id property on groups collection (not teams)
    await queryRunner.query(`
      UPDATE property_definitions pd
      SET
        reference_collection_id = (SELECT id FROM collection_definitions WHERE code = 'groups' LIMIT 1),
        reference_display_property = 'name'
      WHERE pd.code = 'parent_group_id'
        AND pd.collection_id = (SELECT id FROM collection_definitions WHERE code = 'groups' LIMIT 1)
        AND pd.reference_collection_id IS NULL
    `);

    // Update property_type_id property on property_definitions collection
    await queryRunner.query(`
      UPDATE property_definitions pd
      SET
        reference_collection_id = (SELECT id FROM collection_definitions WHERE code = 'property_types' LIMIT 1),
        reference_display_property = 'name'
      WHERE pd.code = 'property_type_id'
        AND pd.collection_id = (SELECT id FROM collection_definitions WHERE code = 'property_definitions' LIMIT 1)
        AND pd.reference_collection_id IS NULL
    `);

    // Update choice_list_id property on choice_items collection
    await queryRunner.query(`
      UPDATE property_definitions pd
      SET
        reference_collection_id = (SELECT id FROM collection_definitions WHERE code = 'choice_lists' LIMIT 1),
        reference_display_property = 'name'
      WHERE pd.code = 'choice_list_id'
        AND pd.collection_id = (SELECT id FROM collection_definitions WHERE code = 'choice_items' LIMIT 1)
        AND pd.reference_collection_id IS NULL
    `);

    // Update role_id property on role_permissions collection
    await queryRunner.query(`
      UPDATE property_definitions pd
      SET
        reference_collection_id = (SELECT id FROM collection_definitions WHERE code = 'roles' LIMIT 1),
        reference_display_property = 'name'
      WHERE pd.code = 'role_id'
        AND pd.collection_id = (SELECT id FROM collection_definitions WHERE code = 'role_permissions' LIMIT 1)
        AND pd.reference_collection_id IS NULL
    `);

    // Update permission_id property on role_permissions collection
    await queryRunner.query(`
      UPDATE property_definitions pd
      SET
        reference_collection_id = (SELECT id FROM collection_definitions WHERE code = 'permissions' LIMIT 1),
        reference_display_property = 'name'
      WHERE pd.code = 'permission_id'
        AND pd.collection_id = (SELECT id FROM collection_definitions WHERE code = 'role_permissions' LIMIT 1)
        AND pd.reference_collection_id IS NULL
    `);

    // Update user_id property on user_roles collection
    await queryRunner.query(`
      UPDATE property_definitions pd
      SET
        reference_collection_id = (SELECT id FROM collection_definitions WHERE code = 'users' LIMIT 1),
        reference_display_property = 'email'
      WHERE pd.code = 'user_id'
        AND pd.collection_id = (SELECT id FROM collection_definitions WHERE code = 'user_roles' LIMIT 1)
        AND pd.reference_collection_id IS NULL
    `);

    // Update role_id property on user_roles collection
    await queryRunner.query(`
      UPDATE property_definitions pd
      SET
        reference_collection_id = (SELECT id FROM collection_definitions WHERE code = 'roles' LIMIT 1),
        reference_display_property = 'name'
      WHERE pd.code = 'role_id'
        AND pd.collection_id = (SELECT id FROM collection_definitions WHERE code = 'user_roles' LIMIT 1)
        AND pd.reference_collection_id IS NULL
    `);

    // Also update config.dataType to 'reference' for all properties that have reference_collection_id
    await queryRunner.query(`
      UPDATE property_definitions
      SET config = COALESCE(config, '{}'::jsonb) || '{"dataType": "reference"}'::jsonb
      WHERE reference_collection_id IS NOT NULL
        AND (config->>'dataType' IS NULL OR config->>'dataType' != 'reference')
    `);

    console.log('Fixed reference property configurations');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Clear reference configurations
    await queryRunner.query(`
      UPDATE property_definitions
      SET
        reference_collection_id = NULL,
        reference_display_property = NULL
      WHERE code IN ('collection_id', 'parent_role_id', 'parent_group_id', 'property_type_id', 'choice_list_id', 'role_id', 'permission_id', 'user_id')
    `);
  }
}
