import { MigrationInterface, QueryRunner } from 'typeorm';

export class IamRearchitecture1778000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Ensure uuid generation
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);

    // Drop legacy IAM/ACL tables to avoid conflicts
    await queryRunner.query(`
      DROP TABLE IF EXISTS table_acl CASCADE;
      DROP TABLE IF EXISTS field_acl CASCADE;
      DROP TABLE IF EXISTS abac_policies CASCADE;
      DROP TABLE IF EXISTS refresh_tokens CASCADE;
      DROP TABLE IF EXISTS auth_events CASCADE;
      DROP TABLE IF EXISTS role_permissions CASCADE;
      DROP TABLE IF EXISTS user_role_assignments CASCADE;
      DROP TABLE IF EXISTS group_roles CASCADE;
      DROP TABLE IF EXISTS user_groups CASCADE;
      DROP TABLE IF EXISTS groups CASCADE;
      DROP TABLE IF EXISTS roles CASCADE;
      DROP TABLE IF EXISTS permissions CASCADE;
      DROP TABLE IF EXISTS tenant_user_memberships CASCADE;
      DROP TABLE IF EXISTS user_accounts CASCADE;
      DROP TABLE IF EXISTS tenant_databases CASCADE;
      DROP TABLE IF EXISTS tenants CASCADE;
      DROP TYPE IF EXISTS acl_operation CASCADE;
      DROP TYPE IF EXISTS field_operation CASCADE;
      DROP TYPE IF EXISTS masking_strategy CASCADE;
      DROP TYPE IF EXISTS policy_resource_type CASCADE;
      DROP TYPE IF EXISTS policy_action CASCADE;
      DROP TYPE IF EXISTS policy_effect CASCADE;
      DROP TYPE IF EXISTS tenant_status CASCADE;
      DROP TYPE IF EXISTS user_account_status CASCADE;
      DROP TYPE IF EXISTS tenant_user_membership_status CASCADE;
      DROP TYPE IF EXISTS group_type CASCADE;
      DROP TYPE IF EXISTS role_assignment_source CASCADE;
    `);

    // Enums
    await queryRunner.query(`CREATE TYPE tenant_status AS ENUM ('ACTIVE', 'SUSPENDED', 'DECOMMISSIONED');`);
    await queryRunner.query(`CREATE TYPE user_account_status AS ENUM ('ACTIVE', 'LOCKED', 'INVITED', 'DISABLED');`);
    await queryRunner.query(
      `CREATE TYPE tenant_user_membership_status AS ENUM ('ACTIVE', 'PENDING_INVITE', 'SUSPENDED');`,
    );
    await queryRunner.query(`CREATE TYPE group_type AS ENUM ('TECHNICIAN', 'MANAGER', 'DEPARTMENT', 'CUSTOM');`);
    await queryRunner.query(`CREATE TYPE policy_resource_type AS ENUM ('table', 'field', 'action');`);
    await queryRunner.query(`CREATE TYPE policy_action AS ENUM ('create', 'read', 'update', 'delete', 'execute');`);
    await queryRunner.query(`CREATE TYPE policy_effect AS ENUM ('ALLOW', 'DENY');`);
    await queryRunner.query(`CREATE TYPE acl_operation AS ENUM ('create', 'read', 'update', 'delete');`);
    await queryRunner.query(`CREATE TYPE field_operation AS ENUM ('read', 'write');`);
    await queryRunner.query(`CREATE TYPE masking_strategy AS ENUM ('NONE', 'PARTIAL', 'FULL');`);
    await queryRunner.query(`CREATE TYPE role_assignment_source AS ENUM ('DIRECT', 'IMPLICIT_ADMIN', 'SYSTEM');`);

    // Tenants
    await queryRunner.query(`
      CREATE TABLE tenants (
        id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        slug              varchar(100) NOT NULL UNIQUE,
        name              varchar(255) NOT NULL,
        status            tenant_status NOT NULL DEFAULT 'ACTIVE',
        db_host           varchar(255),
        db_port           integer,
        db_name           varchar(255),
        db_user           varchar(255),
        db_password_enc   text,
        created_at        timestamptz NOT NULL DEFAULT now(),
        updated_at        timestamptz NOT NULL DEFAULT now()
      );
    `);

    // User accounts (global identities)
    await queryRunner.query(`
      CREATE TABLE user_accounts (
        id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        primary_email   varchar(320) NOT NULL UNIQUE,
        password_hash   text,
        password_algo   varchar(50),
        mfa_enabled     boolean NOT NULL DEFAULT false,
        status          user_account_status NOT NULL DEFAULT 'ACTIVE',
        display_name    varchar(255),
        locale          varchar(20),
        time_zone       varchar(50),
        created_at      timestamptz NOT NULL DEFAULT now(),
        updated_at      timestamptz NOT NULL DEFAULT now()
      );
    `);

    // Tenant membership
    await queryRunner.query(`
      CREATE TABLE tenant_user_memberships (
        id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        user_id         uuid NOT NULL REFERENCES user_accounts(id) ON DELETE CASCADE,
        status          tenant_user_membership_status NOT NULL DEFAULT 'ACTIVE',
        is_tenant_admin boolean NOT NULL DEFAULT false,
        title           varchar(255),
        department      varchar(255),
        employee_id     varchar(100),
        created_at      timestamptz NOT NULL DEFAULT now(),
        updated_at      timestamptz NOT NULL DEFAULT now(),
        UNIQUE (tenant_id, user_id)
      );
    `);

    // Permissions catalog
    await queryRunner.query(`
      CREATE TABLE permissions (
        id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        name         varchar(150) NOT NULL UNIQUE,
        description  text,
        category     varchar(100) NOT NULL,
        created_at   timestamptz NOT NULL DEFAULT now(),
        updated_at   timestamptz NOT NULL DEFAULT now()
      );
    `);

    // Roles
    await queryRunner.query(`
      CREATE TABLE roles (
        id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id    uuid REFERENCES tenants(id) ON DELETE CASCADE,
        slug         varchar(150) NOT NULL,
        name         varchar(255) NOT NULL,
        description  text,
        is_system    boolean NOT NULL DEFAULT false,
        created_at   timestamptz NOT NULL DEFAULT now(),
        updated_at   timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_roles_tenant_slug UNIQUE (tenant_id, slug)
      );
    `);

    // Role permissions
    await queryRunner.query(`
      CREATE TABLE role_permissions (
        id             uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        role_id        uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
        permission_id  uuid NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
        created_at     timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_role_permissions_role_perm UNIQUE (role_id, permission_id)
      );
    `);

    // Role inheritance
    await queryRunner.query(`
      CREATE TABLE role_inheritance (
        id               uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        parent_role_id   uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
        child_role_id    uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
        created_at       timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_role_inheritance UNIQUE (parent_role_id, child_role_id),
        CONSTRAINT chk_role_inheritance_no_self CHECK (parent_role_id <> child_role_id)
      );
    `);

    // Groups
    await queryRunner.query(`
      CREATE TABLE groups (
        id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id    uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        slug         varchar(150) NOT NULL,
        name         varchar(255) NOT NULL,
        type         group_type NOT NULL DEFAULT 'CUSTOM',
        description  text,
        created_at   timestamptz NOT NULL DEFAULT now(),
        updated_at   timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_groups_tenant_slug UNIQUE (tenant_id, slug)
      );
    `);

    // User groups
    await queryRunner.query(`
      CREATE TABLE user_groups (
        id                          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_user_membership_id   uuid NOT NULL REFERENCES tenant_user_memberships(id) ON DELETE CASCADE,
        group_id                    uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
        created_at                  timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_user_groups_membership_group UNIQUE (tenant_user_membership_id, group_id)
      );
    `);

    // Group roles
    await queryRunner.query(`
      CREATE TABLE group_roles (
        id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        group_id     uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
        role_id      uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
        created_at   timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_group_roles_group_role UNIQUE (group_id, role_id)
      );
    `);

    // User role assignments
    await queryRunner.query(`
      CREATE TABLE user_role_assignments (
        id                          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_user_membership_id   uuid NOT NULL REFERENCES tenant_user_memberships(id) ON DELETE CASCADE,
        role_id                     uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
        source                      role_assignment_source NOT NULL DEFAULT 'DIRECT',
        created_at                  timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_user_role_assignments_membership_role UNIQUE (tenant_user_membership_id, role_id)
      );
    `);

    // Table ACL
    await queryRunner.query(`
      CREATE TABLE table_acl (
        id                     uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id              uuid REFERENCES tenants(id) ON DELETE CASCADE,
        table_name             varchar(150) NOT NULL,
        operation              acl_operation NOT NULL,
        required_permission_id uuid REFERENCES permissions(id),
        required_roles         text[],
        condition_expression   jsonb,
        script_reference       varchar(255),
        priority               integer NOT NULL DEFAULT 100,
        is_enabled             boolean NOT NULL DEFAULT true,
        created_at             timestamptz NOT NULL DEFAULT now(),
        updated_at             timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX idx_table_acl_tenant_table_op ON table_acl (tenant_id, table_name, operation);
    `);

    // Field ACL
    await queryRunner.query(`
      CREATE TABLE field_acl (
        id                     uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id              uuid REFERENCES tenants(id) ON DELETE CASCADE,
        table_name             varchar(150) NOT NULL,
        field_name             varchar(150) NOT NULL,
        operation              field_operation NOT NULL,
        required_permission_id uuid REFERENCES permissions(id),
        required_roles         text[],
        condition_expression   jsonb,
        masking_strategy       masking_strategy NOT NULL DEFAULT 'NONE',
        is_enabled             boolean NOT NULL DEFAULT true,
        priority               integer NOT NULL DEFAULT 100,
        created_at             timestamptz NOT NULL DEFAULT now(),
        updated_at             timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_field_acl UNIQUE (tenant_id, table_name, field_name, operation, priority)
      );
      CREATE INDEX idx_field_acl_tenant_table_field ON field_acl (tenant_id, table_name, field_name);
    `);

    // ABAC policies
    await queryRunner.query(`
      CREATE TABLE abac_policies (
        id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id         uuid REFERENCES tenants(id) ON DELETE CASCADE,
        name              varchar(150) NOT NULL,
        description       text,
        subject_filter    jsonb NOT NULL,
        resource_type     policy_resource_type NOT NULL,
        resource          varchar(255) NOT NULL,
        action            policy_action NOT NULL,
        condition         jsonb NOT NULL,
        effect            policy_effect NOT NULL,
        priority          integer NOT NULL DEFAULT 100,
        is_enabled        boolean NOT NULL DEFAULT true,
        created_at        timestamptz NOT NULL DEFAULT now(),
        updated_at        timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_abac_policies_tenant_name UNIQUE (tenant_id, name)
      );
      CREATE INDEX idx_abac_policies_tenant_resource ON abac_policies (tenant_id, resource_type, resource);
    `);

    // Refresh tokens (session persistence and reuse detection)
    await queryRunner.query(`
      CREATE TABLE refresh_tokens (
        id                 uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id            uuid NOT NULL REFERENCES user_accounts(id) ON DELETE CASCADE,
        tenant_id          uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        token_hash         varchar(255) NOT NULL UNIQUE,
        family_id          uuid NOT NULL,
        issued_at          timestamptz NOT NULL DEFAULT now(),
        expires_at         timestamptz NOT NULL,
        last_used_at       timestamptz,
        revoked_at         timestamptz,
        revoked_reason     text,
        replaced_by_id     uuid REFERENCES refresh_tokens(id),
        created_by_ip      inet,
        created_user_agent text,
        last_ip            inet,
        last_user_agent    text,
        is_reuse_suspect   boolean NOT NULL DEFAULT false,
        created_at         timestamptz NOT NULL DEFAULT now(),
        created_by         uuid,
        deleted_at         timestamptz
      );
      CREATE INDEX idx_refresh_tokens_user ON refresh_tokens (user_id, tenant_id);
      CREATE INDEX idx_refresh_tokens_family ON refresh_tokens (family_id);
    `);

    // Auth events for auditability
    await queryRunner.query(`
      CREATE TABLE auth_events (
        id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id       uuid REFERENCES tenants(id) ON DELETE CASCADE,
        user_id         uuid REFERENCES user_accounts(id) ON DELETE CASCADE,
        type            varchar(150) NOT NULL,
        created_at      timestamptz NOT NULL DEFAULT now(),
        ip              inet,
        user_agent      text,
        correlation_id  uuid,
        metadata        jsonb NOT NULL DEFAULT '{}'::jsonb
      );
      CREATE INDEX idx_auth_events_tenant_user ON auth_events (tenant_id, user_id);
    `);

    // Seed baseline tenant/admin for continuity
    const adminPassword =
      '$argon2id$v=19$m=65536,t=3,p=4$fVn8Txx620aU5ZaouOGv+A$yoAgWuo0HBUsYZHX8WjF/Cydr/4qPC1A3SdLK0d/u/A'; // hash of "EasyWay"
    await queryRunner.query(`
      INSERT INTO tenants (id, slug, name, status, db_host, db_port, db_name, db_user, db_password_enc)
      VALUES (
        '776ecf76-b1cb-46eb-80c2-83d5e6a8f14a',
        'acme',
        'Acme Corp',
        'ACTIVE',
        'localhost',
        5432,
        'eam_tenant_acme',
        'admin',
        'password'
      )
      ON CONFLICT (slug) DO NOTHING;

      INSERT INTO user_accounts (id, primary_email, password_hash, password_algo, mfa_enabled, status, display_name)
      VALUES (
        '8841dd54-5b04-442e-9a16-d2662575b386',
        'admin@acme.com',
        '${adminPassword}',
        'argon2id',
        false,
        'ACTIVE',
        'Admin'
      )
      ON CONFLICT (primary_email) DO NOTHING;

      INSERT INTO tenant_user_memberships (id, tenant_id, user_id, status, is_tenant_admin)
      VALUES (
        'a1d4c803-7c8d-4d4c-8e5f-3aefc7e55555',
        (SELECT id FROM tenants WHERE slug='acme'),
        (SELECT id FROM user_accounts WHERE primary_email='admin@acme.com'),
        'ACTIVE',
        true
      )
      ON CONFLICT (tenant_id, user_id) DO NOTHING;

      INSERT INTO roles (id, tenant_id, slug, name, is_system)
      VALUES (
        '2a3c2b48-4c46-49a0-9e14-2a34c3d6f333',
        (SELECT id FROM tenants WHERE slug='acme'),
        'tenant_admin',
        'Tenant Admin',
        true
      )
      ON CONFLICT (tenant_id, slug) DO NOTHING;

      INSERT INTO roles (id, tenant_id, slug, name, is_system)
      VALUES (
        '00000000-0000-0000-0000-000000000001',
        NULL,
        'platform_admin',
        'Platform Administrator',
        true
      )
      ON CONFLICT (tenant_id, slug) DO NOTHING;

      INSERT INTO user_role_assignments (id, tenant_user_membership_id, role_id, source)
      VALUES (
        '6a4d01d0-3b8c-4d0a-9c55-9d5c6d2d7e77',
        (SELECT id FROM tenant_user_memberships WHERE tenant_id=(SELECT id FROM tenants WHERE slug='acme') AND user_id=(SELECT id FROM user_accounts WHERE primary_email='admin@acme.com')),
        (SELECT id FROM roles WHERE tenant_id=(SELECT id FROM tenants WHERE slug='acme') AND slug='tenant_admin'),
        'DIRECT'
      )
      ON CONFLICT (tenant_user_membership_id, role_id) DO NOTHING;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS auth_events CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS refresh_tokens CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS abac_policies CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS field_acl CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS table_acl CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS user_role_assignments CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS group_roles CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS user_groups CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS groups CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS role_inheritance CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS role_permissions CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS roles CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS permissions CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS tenant_user_memberships CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS user_accounts CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS tenants CASCADE;`);
    await queryRunner.query(`DROP TYPE IF EXISTS acl_operation CASCADE;`);
    await queryRunner.query(`DROP TYPE IF EXISTS field_operation CASCADE;`);
    await queryRunner.query(`DROP TYPE IF EXISTS masking_strategy CASCADE;`);
    await queryRunner.query(`DROP TYPE IF EXISTS policy_resource_type CASCADE;`);
    await queryRunner.query(`DROP TYPE IF EXISTS policy_action CASCADE;`);
    await queryRunner.query(`DROP TYPE IF EXISTS policy_effect CASCADE;`);
    await queryRunner.query(`DROP TYPE IF EXISTS role_assignment_source CASCADE;`);
    await queryRunner.query(`DROP TYPE IF EXISTS tenant_status CASCADE;`);
    await queryRunner.query(`DROP TYPE IF EXISTS user_account_status CASCADE;`);
    await queryRunner.query(`DROP TYPE IF EXISTS tenant_user_membership_status CASCADE;`);
    await queryRunner.query(`DROP TYPE IF EXISTS group_type CASCADE;`);
  }
}
