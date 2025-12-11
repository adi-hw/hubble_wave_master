import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Enhance Nav Profile Items
 *
 * This migration enhances the existing tenant_nav_profile_items table with:
 * - key: Unique key within profile for patch targeting
 * - module_key: Reference to Module.key (replaces targetId for modules)
 * - visibility: JSONB for comprehensive visibility rules
 * - context_tags: Array for filtering based on context
 * - smart_group_type: Enum for smart group items
 * - smart_group_limit: Max items for smart groups
 *
 * Also updates the nav_item_type enum to add SMART_GROUP.
 *
 * Enhances tenant_nav_profiles table with:
 * - template_key: Reference to NavTemplate.key
 * - base_checksum: For template change detection
 * - auto_assign_roles: Array of roles for auto-assignment
 * - auto_assign_expression: DSL expression for complex assignment
 * - is_locked: Prevent edits flag
 * - inherits_from_profile_id: Profile inheritance
 * - priority: For auto-assignment ordering
 * - metadata: JSONB for additional configuration
 */
export class EnhanceNavProfileItems1785000001000 implements MigrationInterface {
  name = 'EnhanceNavProfileItems1785000001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add SMART_GROUP to nav_item_type enum if it doesn't exist
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TYPE nav_item_type ADD VALUE IF NOT EXISTS 'SMART_GROUP';
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Add new columns to tenant_nav_profile_items
    await queryRunner.query(`
      ALTER TABLE tenant_nav_profile_items
      ADD COLUMN IF NOT EXISTS key varchar(150),
      ADD COLUMN IF NOT EXISTS module_key varchar(150),
      ADD COLUMN IF NOT EXISTS visibility jsonb,
      ADD COLUMN IF NOT EXISTS context_tags varchar[],
      ADD COLUMN IF NOT EXISTS smart_group_type smart_group_type_enum,
      ADD COLUMN IF NOT EXISTS smart_group_limit int;
    `);

    // Create unique index on (nav_profile_id, key)
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE UNIQUE INDEX idx_nav_profile_items_profile_key
        ON tenant_nav_profile_items(nav_profile_id, key)
        WHERE key IS NOT NULL;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Create index on module_key for joins
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE INDEX idx_nav_profile_items_module_key ON tenant_nav_profile_items(module_key);
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Create index on type for filtering
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE INDEX idx_nav_profile_items_type ON tenant_nav_profile_items(type);
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Add new columns to tenant_nav_profiles
    await queryRunner.query(`
      ALTER TABLE tenant_nav_profiles
      ADD COLUMN IF NOT EXISTS template_key varchar(100),
      ADD COLUMN IF NOT EXISTS base_checksum varchar(64),
      ADD COLUMN IF NOT EXISTS auto_assign_roles varchar[],
      ADD COLUMN IF NOT EXISTS auto_assign_expression text,
      ADD COLUMN IF NOT EXISTS is_locked boolean DEFAULT false,
      ADD COLUMN IF NOT EXISTS inherits_from_profile_id uuid REFERENCES tenant_nav_profiles(id),
      ADD COLUMN IF NOT EXISTS priority int DEFAULT 100,
      ADD COLUMN IF NOT EXISTS metadata jsonb;
    `);

    // Create indexes on new tenant_nav_profiles columns
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE INDEX idx_nav_profiles_template_key ON tenant_nav_profiles(template_key);
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE INDEX idx_nav_profiles_is_default ON tenant_nav_profiles(is_default) WHERE is_default = true;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE INDEX idx_nav_profiles_is_active ON tenant_nav_profiles(is_active) WHERE is_active = true;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE INDEX idx_nav_profiles_inherits ON tenant_nav_profiles(inherits_from_profile_id);
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Generate keys for existing nav items (if any)
    // Uses a combination of parent hierarchy and label
    await queryRunner.query(`
      WITH RECURSIVE item_path AS (
        -- Base case: items without parents
        SELECT
          id,
          nav_profile_id,
          label,
          parent_id,
          lower(regexp_replace(label, '[^a-zA-Z0-9]', '_', 'g')) as path_key
        FROM tenant_nav_profile_items
        WHERE parent_id IS NULL

        UNION ALL

        -- Recursive case: items with parents
        SELECT
          i.id,
          i.nav_profile_id,
          i.label,
          i.parent_id,
          ip.path_key || '.' || lower(regexp_replace(i.label, '[^a-zA-Z0-9]', '_', 'g'))
        FROM tenant_nav_profile_items i
        JOIN item_path ip ON i.parent_id = ip.id
      )
      UPDATE tenant_nav_profile_items t
      SET key = ip.path_key
      FROM item_path ip
      WHERE t.id = ip.id
      AND t.key IS NULL;
    `);

    // Migrate existing required_permission to visibility.permissionsAny
    await queryRunner.query(`
      UPDATE tenant_nav_profile_items
      SET visibility = jsonb_build_object('permissionsAny', ARRAY[required_permission])
      WHERE required_permission IS NOT NULL
      AND visibility IS NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove indexes
    await queryRunner.query(`DROP INDEX IF EXISTS idx_nav_profiles_inherits;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_nav_profiles_is_active;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_nav_profiles_is_default;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_nav_profiles_template_key;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_nav_profile_items_type;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_nav_profile_items_module_key;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_nav_profile_items_profile_key;`);

    // Remove new columns from tenant_nav_profiles
    await queryRunner.query(`
      ALTER TABLE tenant_nav_profiles
      DROP COLUMN IF EXISTS template_key,
      DROP COLUMN IF EXISTS base_checksum,
      DROP COLUMN IF EXISTS auto_assign_roles,
      DROP COLUMN IF EXISTS auto_assign_expression,
      DROP COLUMN IF EXISTS is_locked,
      DROP COLUMN IF EXISTS inherits_from_profile_id,
      DROP COLUMN IF EXISTS priority,
      DROP COLUMN IF EXISTS metadata;
    `);

    // Remove new columns from tenant_nav_profile_items
    await queryRunner.query(`
      ALTER TABLE tenant_nav_profile_items
      DROP COLUMN IF EXISTS key,
      DROP COLUMN IF EXISTS module_key,
      DROP COLUMN IF EXISTS visibility,
      DROP COLUMN IF EXISTS context_tags,
      DROP COLUMN IF EXISTS smart_group_type,
      DROP COLUMN IF EXISTS smart_group_limit;
    `);

    // Note: Cannot remove enum value SMART_GROUP from nav_item_type
    // PostgreSQL doesn't support removing enum values
  }
}
