import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Next-Gen Navigation System - Core Tables
 *
 * This migration creates the new navigation system tables:
 * - applications: Logical product/domain groupings (EAM, ITSM, etc.)
 * - nav_templates: Predefined navigation structures for profiles
 * - nav_patches: Modifications to navigation profiles
 *
 * Also creates required enum types:
 * - owner_type_enum: platform vs tenant ownership
 * - module_type_enum: Types of modules (list, record, dashboard, etc.)
 * - nav_patch_operation_enum: Types of patch operations
 * - smart_group_type_enum: Types of smart groups (favorites, recent, frequent)
 */
export class CreateNavigationTables1785000000000 implements MigrationInterface {
  name = 'CreateNavigationTables1785000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create enum types
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE owner_type_enum AS ENUM ('platform', 'tenant');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE module_type_enum AS ENUM ('list', 'record', 'dashboard', 'wizard', 'url', 'custom', 'report', 'form');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE nav_patch_operation_enum AS ENUM ('hide', 'show', 'move', 'rename', 'insert', 'replace', 'clone', 'set_visibility', 'set_icon', 'reorder');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE smart_group_type_enum AS ENUM ('favorites', 'recent', 'frequent');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Create applications table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS applications (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        key varchar(100) NOT NULL UNIQUE,
        label varchar(255) NOT NULL,
        icon varchar(50),
        category varchar(100),
        owner_type owner_type_enum DEFAULT 'tenant',
        description text,
        is_active boolean DEFAULT true,
        sort_order int DEFAULT 0,
        metadata jsonb,
        created_by uuid,
        updated_by uuid,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now(),
        deleted_at timestamptz
      );
    `);

    await queryRunner.query(`CREATE INDEX idx_applications_key ON applications(key);`);
    await queryRunner.query(`CREATE INDEX idx_applications_category ON applications(category);`);
    await queryRunner.query(`CREATE INDEX idx_applications_owner_type ON applications(owner_type);`);
    await queryRunner.query(`CREATE INDEX idx_applications_is_active ON applications(is_active) WHERE is_active = true;`);

    // Create nav_templates table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS nav_templates (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        key varchar(100) NOT NULL UNIQUE,
        name varchar(255) NOT NULL,
        description text,
        category varchar(100),
        owner_type owner_type_enum DEFAULT 'tenant',
        base_applications varchar[] DEFAULT '{}',
        nav_structure jsonb NOT NULL DEFAULT '[]',
        is_active boolean DEFAULT true,
        version varchar(20) DEFAULT '1.0.0',
        checksum varchar(64),
        metadata jsonb,
        created_by uuid,
        updated_by uuid,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now(),
        deleted_at timestamptz
      );
    `);

    await queryRunner.query(`CREATE INDEX idx_nav_templates_key ON nav_templates(key);`);
    await queryRunner.query(`CREATE INDEX idx_nav_templates_category ON nav_templates(category);`);
    await queryRunner.query(`CREATE INDEX idx_nav_templates_owner_type ON nav_templates(owner_type);`);
    await queryRunner.query(`CREATE INDEX idx_nav_templates_is_active ON nav_templates(is_active) WHERE is_active = true;`);

    // Create nav_patches table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS nav_patches (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        nav_profile_id uuid NOT NULL REFERENCES tenant_nav_profiles(id) ON DELETE CASCADE,
        operation nav_patch_operation_enum NOT NULL,
        target_node_key varchar(150) NOT NULL,
        payload jsonb,
        priority int DEFAULT 100,
        is_active boolean DEFAULT true,
        description text,
        metadata jsonb,
        created_by uuid,
        updated_by uuid,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      );
    `);

    await queryRunner.query(`CREATE INDEX idx_nav_patches_profile ON nav_patches(nav_profile_id);`);
    await queryRunner.query(`CREATE INDEX idx_nav_patches_profile_priority ON nav_patches(nav_profile_id, priority);`);
    await queryRunner.query(`CREATE INDEX idx_nav_patches_operation ON nav_patches(operation);`);
    await queryRunner.query(`CREATE INDEX idx_nav_patches_target ON nav_patches(target_node_key);`);
    await queryRunner.query(`CREATE INDEX idx_nav_patches_is_active ON nav_patches(is_active) WHERE is_active = true;`);

    // Add new columns to existing modules table
    await queryRunner.query(`
      ALTER TABLE modules
      ADD COLUMN IF NOT EXISTS key varchar(150),
      ADD COLUMN IF NOT EXISTS label varchar(255),
      ADD COLUMN IF NOT EXISTS application_key varchar(100),
      ADD COLUMN IF NOT EXISTS type module_type_enum DEFAULT 'list',
      ADD COLUMN IF NOT EXISTS target_config jsonb,
      ADD COLUMN IF NOT EXISTS security jsonb,
      ADD COLUMN IF NOT EXISTS owner_type owner_type_enum DEFAULT 'tenant',
      ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true,
      ADD COLUMN IF NOT EXISTS metadata jsonb,
      ADD COLUMN IF NOT EXISTS created_by uuid,
      ADD COLUMN IF NOT EXISTS updated_by uuid;
    `);

    // Create unique index on modules.key if it doesn't exist
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE UNIQUE INDEX idx_modules_key ON modules(key) WHERE key IS NOT NULL;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE INDEX idx_modules_application_key ON modules(application_key);
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE INDEX idx_modules_type ON modules(type);
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE INDEX idx_modules_owner_type ON modules(owner_type);
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE INDEX idx_modules_is_active ON modules(is_active) WHERE is_active = true;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Backfill key column from slug for existing modules
    await queryRunner.query(`
      UPDATE modules
      SET key = slug
      WHERE key IS NULL AND slug IS NOT NULL;
    `);

    // Seed EAM application as platform-provided
    await queryRunner.query(`
      INSERT INTO applications (key, label, icon, category, owner_type, description, sort_order)
      VALUES
        ('eam', 'Enterprise Asset Management', 'Box', 'Core', 'platform', 'Core EAM functionality for managing enterprise assets', 0),
        ('admin', 'Administration', 'Settings', 'System', 'platform', 'System administration and configuration', 100),
        ('studio', 'Studio', 'Paintbrush', 'System', 'platform', 'Development and customization tools', 101)
      ON CONFLICT (key) DO NOTHING;
    `);

    // Update table_ui_config to show new tables as system/hidden
    await queryRunner.query(`
      INSERT INTO table_ui_config (table_name, label, category, is_hidden, is_system) VALUES
        ('applications', 'Applications', 'navigation', true, true),
        ('nav_templates', 'Nav Templates', 'navigation', true, true),
        ('nav_patches', 'Nav Patches', 'navigation', true, true)
      ON CONFLICT (table_name) DO NOTHING;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove table_ui_config entries
    await queryRunner.query(`
      DELETE FROM table_ui_config WHERE table_name IN ('applications', 'nav_templates', 'nav_patches');
    `);

    // Remove new columns from modules
    await queryRunner.query(`
      ALTER TABLE modules
      DROP COLUMN IF EXISTS key,
      DROP COLUMN IF EXISTS label,
      DROP COLUMN IF EXISTS application_key,
      DROP COLUMN IF EXISTS type,
      DROP COLUMN IF EXISTS target_config,
      DROP COLUMN IF EXISTS security,
      DROP COLUMN IF EXISTS owner_type,
      DROP COLUMN IF EXISTS is_active,
      DROP COLUMN IF EXISTS metadata,
      DROP COLUMN IF EXISTS created_by,
      DROP COLUMN IF EXISTS updated_by;
    `);

    // Drop tables
    await queryRunner.query(`DROP TABLE IF EXISTS nav_patches;`);
    await queryRunner.query(`DROP TABLE IF EXISTS nav_templates;`);
    await queryRunner.query(`DROP TABLE IF EXISTS applications;`);

    // Drop enum types
    await queryRunner.query(`DROP TYPE IF EXISTS smart_group_type_enum;`);
    await queryRunner.query(`DROP TYPE IF EXISTS nav_patch_operation_enum;`);
    await queryRunner.query(`DROP TYPE IF EXISTS module_type_enum;`);
    await queryRunner.query(`DROP TYPE IF EXISTS owner_type_enum;`);
  }
}
