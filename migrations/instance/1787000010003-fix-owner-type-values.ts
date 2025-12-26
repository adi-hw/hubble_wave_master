import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Fix Owner Type Values
 *
 * This migration fixes the owner_type column values that were incorrectly set to 'custom'
 * due to a bug in the seed migration (used 'owner' column instead of 'owner_type').
 *
 * This updates existing collections to their correct owner_type based on what
 * was defined in the seed migration (1787000010002-seed-platform-collections.ts).
 *
 * OWNERSHIP MODEL:
 * - system: Immutable infrastructure (audit_logs, schema_change_log, schema_sync_state)
 * - platform: Core platform collections that can be extended with custom properties
 * - custom: User-created collections (not seeded, created dynamically)
 */
export class FixOwnerTypeValues1787000010003 implements MigrationInterface {
  name = 'FixOwnerTypeValues1787000010003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // =========================================================================
    // SYSTEM collections (3 total) - Immutable infrastructure
    // =========================================================================
    await queryRunner.query(`
      UPDATE collection_definitions
      SET owner_type = 'system'
      WHERE code IN ('audit_logs', 'schema_change_log', 'schema_sync_state')
    `);

    // =========================================================================
    // PLATFORM collections (53 total) - All seeded collections except system
    // These are the collections defined in the seed migration with owner: 'platform'
    // =========================================================================
    await queryRunner.query(`
      UPDATE collection_definitions
      SET owner_type = 'platform'
      WHERE code IN (
        -- Identity & Access
        'users', 'roles', 'groups', 'permissions',
        'group_members', 'group_roles', 'role_permissions', 'user_roles',

        -- Authentication
        'auth_settings', 'auth_events', 'mfa_methods',
        'password_policies', 'password_history',
        'refresh_tokens', 'user_sessions',
        'email_verification_tokens', 'password_reset_tokens',
        'sso_providers', 'ldap_configs', 'user_invitations',

        -- Schema Engine
        'collection_definitions', 'property_definitions', 'property_types',
        'choice_lists', 'choice_items',
        'form_definitions', 'form_versions',

        -- Access Control (ABAC)
        'collection_access_rules', 'property_access_rules',
        'access_conditions', 'access_condition_groups',
        'access_audit_logs', 'access_rule_audit_logs',
        'property_audit_logs',

        -- API & Security
        'api_keys',

        -- Settings & Configuration
        'instance_settings', 'instance_branding', 'instance_customizations',
        'config_change_history',

        -- Theme System
        'theme_definitions', 'user_theme_preferences',

        -- User Preferences
        'user_preferences',

        -- Navigation
        'modules', 'module_security',
        'nav_profiles', 'nav_profile_items', 'nav_nodes', 'nav_patches',

        -- AVA Integration
        'ava_global_settings', 'ava_conversations',
        'ava_permission_configs', 'ava_audit_trail',

        -- Document Processing
        'document_chunks'
      )
    `);

    // Log the result
    const result = await queryRunner.query(`
      SELECT owner_type, COUNT(*) as count
      FROM collection_definitions
      GROUP BY owner_type
      ORDER BY owner_type
    `);
    console.log('Owner type distribution after fix:', result);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Reset all owner_type to 'custom' (restore previous incorrect state)
    await queryRunner.query(`
      UPDATE collection_definitions
      SET owner_type = 'custom'
    `);
  }
}
