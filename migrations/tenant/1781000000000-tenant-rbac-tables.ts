import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Tenant RBAC and Navigation Tables
 *
 * Creates tenant-scoped tables for:
 * - Roles, Permissions, and their mappings
 * - Groups and group memberships
 * - Navigation profiles
 * - Table and Field ACLs
 *
 * These tables replace the platform-db versions for tenant-specific RBAC.
 */
export class TenantRbacTables1781000000000 implements MigrationInterface {
  name = 'TenantRbacTables1781000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create enum types
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tenant_group_type') THEN
          CREATE TYPE tenant_group_type AS ENUM ('CUSTOM', 'DEPARTMENT', 'TEAM', 'PROJECT', 'LOCATION');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'nav_item_type') THEN
          CREATE TYPE nav_item_type AS ENUM ('MODULE', 'TABLE', 'FORM', 'REPORT', 'DASHBOARD', 'LINK', 'SEPARATOR', 'GROUP');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'acl_principal_type') THEN
          CREATE TYPE acl_principal_type AS ENUM ('role', 'group', 'user');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'acl_operation') THEN
          CREATE TYPE acl_operation AS ENUM ('read', 'create', 'write', 'delete');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'field_acl_access') THEN
          CREATE TYPE field_acl_access AS ENUM ('none', 'read', 'write');
        END IF;
      END
      $$;
    `);

    // Create tenant_roles table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS tenant_roles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        slug VARCHAR(100) NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        is_system BOOLEAN DEFAULT FALSE,
        is_active BOOLEAN DEFAULT TRUE,
        priority INTEGER DEFAULT 0,
        created_by UUID,
        updated_by UUID,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        deleted_at TIMESTAMPTZ,
        CONSTRAINT uq_tenant_roles_slug UNIQUE (slug)
      );
      CREATE INDEX IF NOT EXISTS idx_tenant_roles_slug ON tenant_roles(slug);
    `);

    // Create tenant_permissions table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS tenant_permissions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        slug VARCHAR(100) NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        category VARCHAR(50) NOT NULL,
        resource_type VARCHAR(50),
        resource_id VARCHAR(255),
        is_system BOOLEAN DEFAULT FALSE,
        created_by UUID,
        updated_by UUID,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        deleted_at TIMESTAMPTZ,
        CONSTRAINT uq_tenant_permissions_slug UNIQUE (slug)
      );
      CREATE INDEX IF NOT EXISTS idx_tenant_permissions_slug ON tenant_permissions(slug);
      CREATE INDEX IF NOT EXISTS idx_tenant_permissions_category ON tenant_permissions(category);
    `);

    // Create tenant_role_permissions table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS tenant_role_permissions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        role_id UUID NOT NULL REFERENCES tenant_roles(id) ON DELETE CASCADE,
        permission_id UUID NOT NULL REFERENCES tenant_permissions(id) ON DELETE CASCADE,
        granted_by UUID,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        CONSTRAINT uq_tenant_role_permissions UNIQUE (role_id, permission_id)
      );
      CREATE INDEX IF NOT EXISTS idx_tenant_role_permissions_role ON tenant_role_permissions(role_id);
      CREATE INDEX IF NOT EXISTS idx_tenant_role_permissions_permission ON tenant_role_permissions(permission_id);
    `);

    // Create tenant_user_roles table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS tenant_user_roles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        role_id UUID NOT NULL REFERENCES tenant_roles(id) ON DELETE CASCADE,
        assigned_by UUID,
        expires_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        CONSTRAINT uq_tenant_user_roles UNIQUE (user_id, role_id)
      );
      CREATE INDEX IF NOT EXISTS idx_tenant_user_roles_user ON tenant_user_roles(user_id);
      CREATE INDEX IF NOT EXISTS idx_tenant_user_roles_role ON tenant_user_roles(role_id);
    `);

    // Create tenant_groups table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS tenant_groups (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        slug VARCHAR(100) NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        type tenant_group_type DEFAULT 'CUSTOM',
        parent_id UUID,
        is_active BOOLEAN DEFAULT TRUE,
        metadata JSONB,
        created_by UUID,
        updated_by UUID,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        deleted_at TIMESTAMPTZ,
        CONSTRAINT uq_tenant_groups_slug UNIQUE (slug)
      );
      CREATE INDEX IF NOT EXISTS idx_tenant_groups_slug ON tenant_groups(slug);
      CREATE INDEX IF NOT EXISTS idx_tenant_groups_type ON tenant_groups(type);
    `);

    // Create tenant_group_members table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS tenant_group_members (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        group_id UUID NOT NULL REFERENCES tenant_groups(id) ON DELETE CASCADE,
        user_id UUID NOT NULL,
        is_manager BOOLEAN DEFAULT FALSE,
        added_by UUID,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        CONSTRAINT uq_tenant_group_members UNIQUE (group_id, user_id)
      );
      CREATE INDEX IF NOT EXISTS idx_tenant_group_members_group ON tenant_group_members(group_id);
      CREATE INDEX IF NOT EXISTS idx_tenant_group_members_user ON tenant_group_members(user_id);
    `);

    // Create tenant_group_roles table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS tenant_group_roles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        group_id UUID NOT NULL REFERENCES tenant_groups(id) ON DELETE CASCADE,
        role_id UUID NOT NULL REFERENCES tenant_roles(id) ON DELETE CASCADE,
        assigned_by UUID,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        CONSTRAINT uq_tenant_group_roles UNIQUE (group_id, role_id)
      );
      CREATE INDEX IF NOT EXISTS idx_tenant_group_roles_group ON tenant_group_roles(group_id);
      CREATE INDEX IF NOT EXISTS idx_tenant_group_roles_role ON tenant_group_roles(role_id);
    `);

    // Create tenant_nav_profiles table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS tenant_nav_profiles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        slug VARCHAR(100) NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        is_default BOOLEAN DEFAULT FALSE,
        is_active BOOLEAN DEFAULT TRUE,
        created_by UUID,
        updated_by UUID,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        deleted_at TIMESTAMPTZ,
        CONSTRAINT uq_tenant_nav_profiles_slug UNIQUE (slug)
      );
      CREATE INDEX IF NOT EXISTS idx_tenant_nav_profiles_slug ON tenant_nav_profiles(slug);
    `);

    // Create tenant_nav_profile_items table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS tenant_nav_profile_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        nav_profile_id UUID NOT NULL REFERENCES tenant_nav_profiles(id) ON DELETE CASCADE,
        parent_id UUID,
        label VARCHAR(255) NOT NULL,
        icon VARCHAR(50),
        type nav_item_type DEFAULT 'LINK',
        target_id VARCHAR(255),
        url VARCHAR(500),
        "order" INTEGER DEFAULT 0,
        is_visible BOOLEAN DEFAULT TRUE,
        required_permission VARCHAR(100),
        metadata JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_tenant_nav_profile_items_profile ON tenant_nav_profile_items(nav_profile_id, "order");
      CREATE INDEX IF NOT EXISTS idx_tenant_nav_profile_items_parent ON tenant_nav_profile_items(parent_id);
    `);

    // Create tenant_table_acls table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS tenant_table_acls (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        table_code VARCHAR(100) NOT NULL,
        principal_type acl_principal_type NOT NULL,
        principal_id UUID NOT NULL,
        operation acl_operation NOT NULL,
        is_allowed BOOLEAN DEFAULT TRUE,
        condition TEXT,
        created_by UUID,
        updated_by UUID,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        CONSTRAINT uq_tenant_table_acls UNIQUE (table_code, principal_type, principal_id, operation)
      );
      CREATE INDEX IF NOT EXISTS idx_tenant_table_acls_table ON tenant_table_acls(table_code);
      CREATE INDEX IF NOT EXISTS idx_tenant_table_acls_principal ON tenant_table_acls(principal_type, principal_id);
    `);

    // Create tenant_field_acls table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS tenant_field_acls (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        table_code VARCHAR(100) NOT NULL,
        field_code VARCHAR(100) NOT NULL,
        principal_type acl_principal_type NOT NULL,
        principal_id UUID NOT NULL,
        access field_acl_access DEFAULT 'read',
        created_by UUID,
        updated_by UUID,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        CONSTRAINT uq_tenant_field_acls UNIQUE (table_code, field_code, principal_type, principal_id)
      );
      CREATE INDEX IF NOT EXISTS idx_tenant_field_acls_table_field ON tenant_field_acls(table_code, field_code);
      CREATE INDEX IF NOT EXISTS idx_tenant_field_acls_principal ON tenant_field_acls(principal_type, principal_id);
    `);

    // Seed default roles
    await queryRunner.query(`
      INSERT INTO tenant_roles (slug, name, description, is_system, priority)
      VALUES
        ('viewer', 'Viewer', 'Read-only access to data', true, 10),
        ('editor', 'Editor', 'Can create and edit data', true, 20),
        ('manager', 'Manager', 'Can manage data and approve requests', true, 30),
        ('admin', 'Administrator', 'Full administrative access within the tenant', true, 100)
      ON CONFLICT (slug) DO NOTHING;
    `);

    // Seed default navigation profile
    await queryRunner.query(`
      INSERT INTO tenant_nav_profiles (slug, name, description, is_default)
      VALUES ('default', 'Default Navigation', 'Default navigation profile for all users', true)
      ON CONFLICT (slug) DO NOTHING;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS tenant_field_acls;`);
    await queryRunner.query(`DROP TABLE IF EXISTS tenant_table_acls;`);
    await queryRunner.query(`DROP TABLE IF EXISTS tenant_nav_profile_items;`);
    await queryRunner.query(`DROP TABLE IF EXISTS tenant_nav_profiles;`);
    await queryRunner.query(`DROP TABLE IF EXISTS tenant_group_roles;`);
    await queryRunner.query(`DROP TABLE IF EXISTS tenant_group_members;`);
    await queryRunner.query(`DROP TABLE IF EXISTS tenant_groups;`);
    await queryRunner.query(`DROP TABLE IF EXISTS tenant_user_roles;`);
    await queryRunner.query(`DROP TABLE IF EXISTS tenant_role_permissions;`);
    await queryRunner.query(`DROP TABLE IF EXISTS tenant_permissions;`);
    await queryRunner.query(`DROP TABLE IF EXISTS tenant_roles;`);
    await queryRunner.query(`DROP TYPE IF EXISTS field_acl_access;`);
    await queryRunner.query(`DROP TYPE IF EXISTS acl_operation;`);
    await queryRunner.query(`DROP TYPE IF EXISTS acl_principal_type;`);
    await queryRunner.query(`DROP TYPE IF EXISTS nav_item_type;`);
    await queryRunner.query(`DROP TYPE IF EXISTS tenant_group_type;`);
  }
}
