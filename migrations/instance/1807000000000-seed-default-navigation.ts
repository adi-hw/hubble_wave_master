import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Seed Default Navigation
 *
 * This migration creates the default navigation profile and populates
 * the sidebar with all implemented platform features.
 *
 * Navigation Structure:
 * - Home
 * - Studio (Admin)
 *   - Users
 *   - Groups
 *   - Roles
 *   - Collections
 *   - Navigation
 *   - SSO Configuration
 *   - LDAP Configuration
 *   - Audit Logs
 * - Automation
 *   - Automation Rules
 *   - Process Flows
 * - Integrations
 *   - API Explorer
 *   - Webhooks
 *   - Import/Export
 * - Settings
 *   - Profile
 *   - Security
 *   - Themes
 */
export class SeedDefaultNavigation1807000000000 implements MigrationInterface {
  name = 'SeedDefaultNavigation1807000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // =========================================================================
    // STEP 1: Create default navigation profile
    // =========================================================================

    await queryRunner.query(`
      INSERT INTO nav_profiles (id, code, name, description, scope, is_default, is_active)
      VALUES (
        'a0000000-0000-0000-0000-000000000001',
        'default',
        'Default Navigation',
        'Default navigation profile for all users',
        'global',
        true,
        true
      )
      ON CONFLICT (code) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        is_default = EXCLUDED.is_default,
        is_active = EXCLUDED.is_active
    `);

    const profileId = 'a0000000-0000-0000-0000-000000000001';

    // =========================================================================
    // STEP 2: Create navigation nodes using uuid_generate_v4()
    // =========================================================================

    // ─────────────────────────────────────────────────────────────────────────
    // ROOT LEVEL ITEMS
    // ─────────────────────────────────────────────────────────────────────────

    // Home
    await queryRunner.query(`
      INSERT INTO nav_nodes (id, profile_id, key, label, icon, type, url, parent_id, "order", module_key, is_visible)
      VALUES (uuid_generate_v4(), '${profileId}', 'home', 'Home', 'home', 'module', '/home', NULL, 0, NULL, true)
      ON CONFLICT DO NOTHING
    `);

    // ─────────────────────────────────────────────────────────────────────────
    // STUDIO GROUP (Admin)
    // ─────────────────────────────────────────────────────────────────────────

    // Insert Studio group and get its ID
    await queryRunner.query(`
      INSERT INTO nav_nodes (id, profile_id, key, label, icon, type, url, parent_id, "order", module_key, is_visible)
      VALUES ('b0000001-0001-0001-0001-000000000010', '${profileId}', 'studio', 'Studio', 'settings-2', 'group', NULL, NULL, 10, NULL, true)
      ON CONFLICT DO NOTHING
    `);

    const studioParentId = 'b0000001-0001-0001-0001-000000000010';

    // Studio children
    await queryRunner.query(`
      INSERT INTO nav_nodes (id, profile_id, key, label, icon, type, url, parent_id, "order", module_key, is_visible)
      VALUES
        (uuid_generate_v4(), '${profileId}', 'studio.users', 'Users', 'users', 'module', '/studio/users', '${studioParentId}', 0, NULL, true),
        (uuid_generate_v4(), '${profileId}', 'studio.groups', 'Groups', 'users-round', 'module', '/studio/groups', '${studioParentId}', 1, NULL, true),
        (uuid_generate_v4(), '${profileId}', 'studio.roles', 'Roles & Permissions', 'shield', 'module', '/studio/roles', '${studioParentId}', 2, NULL, true),
        (uuid_generate_v4(), '${profileId}', 'studio.collections', 'Collections', 'database', 'module', '/studio/collections', '${studioParentId}', 3, NULL, true),
        (uuid_generate_v4(), '${profileId}', 'studio.navigation', 'Navigation', 'menu', 'module', '/studio/navigation', '${studioParentId}', 4, NULL, true),
        (uuid_generate_v4(), '${profileId}', 'studio.sso', 'SSO Configuration', 'key-round', 'module', '/studio/sso', '${studioParentId}', 5, NULL, true),
        (uuid_generate_v4(), '${profileId}', 'studio.ldap', 'LDAP Configuration', 'server', 'module', '/studio/ldap', '${studioParentId}', 6, NULL, true),
        (uuid_generate_v4(), '${profileId}', 'studio.audit', 'Audit Logs', 'scroll-text', 'module', '/studio/audit', '${studioParentId}', 7, NULL, true)
      ON CONFLICT DO NOTHING
    `);

    // ─────────────────────────────────────────────────────────────────────────
    // AUTOMATION GROUP
    // ─────────────────────────────────────────────────────────────────────────

    await queryRunner.query(`
      INSERT INTO nav_nodes (id, profile_id, key, label, icon, type, url, parent_id, "order", module_key, is_visible)
      VALUES ('b0000001-0001-0001-0001-000000000020', '${profileId}', 'automation', 'Automation', 'zap', 'group', NULL, NULL, 20, NULL, true)
      ON CONFLICT DO NOTHING
    `);

    const automationParentId = 'b0000001-0001-0001-0001-000000000020';

    await queryRunner.query(`
      INSERT INTO nav_nodes (id, profile_id, key, label, icon, type, url, parent_id, "order", module_key, is_visible)
      VALUES
        (uuid_generate_v4(), '${profileId}', 'automation.rules', 'Automation Rules', 'zap', 'module', '/automation', '${automationParentId}', 0, NULL, true),
        (uuid_generate_v4(), '${profileId}', 'automation.process-flows', 'Process Flows', 'git-branch', 'module', '/process-flows', '${automationParentId}', 1, NULL, true)
      ON CONFLICT DO NOTHING
    `);

    // ─────────────────────────────────────────────────────────────────────────
    // INTEGRATIONS GROUP
    // ─────────────────────────────────────────────────────────────────────────

    await queryRunner.query(`
      INSERT INTO nav_nodes (id, profile_id, key, label, icon, type, url, parent_id, "order", module_key, is_visible)
      VALUES ('b0000001-0001-0001-0001-000000000030', '${profileId}', 'integrations', 'Integrations', 'plug', 'group', NULL, NULL, 30, NULL, true)
      ON CONFLICT DO NOTHING
    `);

    const integrationsParentId = 'b0000001-0001-0001-0001-000000000030';

    await queryRunner.query(`
      INSERT INTO nav_nodes (id, profile_id, key, label, icon, type, url, parent_id, "order", module_key, is_visible)
      VALUES
        (uuid_generate_v4(), '${profileId}', 'integrations.api', 'API Explorer', 'code', 'module', '/integrations/api', '${integrationsParentId}', 0, NULL, true),
        (uuid_generate_v4(), '${profileId}', 'integrations.webhooks', 'Webhooks', 'webhook', 'module', '/integrations/webhooks', '${integrationsParentId}', 1, NULL, true),
        (uuid_generate_v4(), '${profileId}', 'integrations.import-export', 'Import/Export', 'arrow-left-right', 'module', '/integrations/import-export', '${integrationsParentId}', 2, NULL, true),
        (uuid_generate_v4(), '${profileId}', 'integrations.marketplace', 'Marketplace', 'store', 'module', '/integrations/marketplace', '${integrationsParentId}', 3, NULL, true)
      ON CONFLICT DO NOTHING
    `);

    // ─────────────────────────────────────────────────────────────────────────
    // AI / AVA GROUP (Phase 7 Revolutionary Features)
    // ─────────────────────────────────────────────────────────────────────────

    await queryRunner.query(`
      INSERT INTO nav_nodes (id, profile_id, key, label, icon, type, url, parent_id, "order", module_key, is_visible)
      VALUES ('b0000001-0001-0001-0001-000000000040', '${profileId}', 'ai', 'AVA Intelligence', 'sparkles', 'group', NULL, NULL, 40, NULL, true)
      ON CONFLICT DO NOTHING
    `);

    const aiParentId = 'b0000001-0001-0001-0001-000000000040';

    await queryRunner.query(`
      INSERT INTO nav_nodes (id, profile_id, key, label, icon, type, url, parent_id, "order", module_key, is_visible)
      VALUES
        (uuid_generate_v4(), '${profileId}', 'ai.query', 'Chat with AVA', 'message-circle', 'module', '/ai/query', '${aiParentId}', 0, NULL, true),
        (uuid_generate_v4(), '${profileId}', 'ai.reports', 'AI Reports', 'file-bar-chart', 'module', '/ai/reports', '${aiParentId}', 1, NULL, true),
        (uuid_generate_v4(), '${profileId}', 'ai.predictive-ops', 'Predictive Operations', 'trending-up', 'module', '/ai/predictive-ops', '${aiParentId}', 2, NULL, true),
        (uuid_generate_v4(), '${profileId}', 'ai.digital-twins', 'Digital Twins', 'copy', 'module', '/ai/digital-twins', '${aiParentId}', 3, NULL, true),
        (uuid_generate_v4(), '${profileId}', 'ai.self-healing', 'Self-Healing', 'heart-pulse', 'module', '/ai/self-healing', '${aiParentId}', 4, NULL, true),
        (uuid_generate_v4(), '${profileId}', 'ai.docs', 'Living Documentation', 'book-open', 'module', '/ai/docs', '${aiParentId}', 5, NULL, true),
        (uuid_generate_v4(), '${profileId}', 'ai.agile', 'Agile Development', 'kanban', 'module', '/ai/agile', '${aiParentId}', 6, NULL, true),
        (uuid_generate_v4(), '${profileId}', 'ai.app-builder', 'App Builder', 'blocks', 'module', '/ai/app-builder', '${aiParentId}', 7, NULL, true),
        (uuid_generate_v4(), '${profileId}', 'ai.upgrade', 'Upgrade Assistant', 'arrow-up-circle', 'module', '/ai/upgrade', '${aiParentId}', 8, NULL, true)
      ON CONFLICT DO NOTHING
    `);

    // ─────────────────────────────────────────────────────────────────────────
    // NOTIFICATIONS
    // ─────────────────────────────────────────────────────────────────────────

    await queryRunner.query(`
      INSERT INTO nav_nodes (id, profile_id, key, label, icon, type, url, parent_id, "order", module_key, is_visible)
      VALUES (uuid_generate_v4(), '${profileId}', 'notifications', 'Notifications', 'bell', 'module', '/notifications', NULL, 50, NULL, true)
      ON CONFLICT DO NOTHING
    `);

    // ─────────────────────────────────────────────────────────────────────────
    // SETTINGS GROUP
    // ─────────────────────────────────────────────────────────────────────────

    await queryRunner.query(`
      INSERT INTO nav_nodes (id, profile_id, key, label, icon, type, url, parent_id, "order", module_key, is_visible)
      VALUES ('b0000001-0001-0001-0001-000000000060', '${profileId}', 'settings', 'Settings', 'settings', 'group', NULL, NULL, 60, NULL, true)
      ON CONFLICT DO NOTHING
    `);

    const settingsParentId = 'b0000001-0001-0001-0001-000000000060';

    await queryRunner.query(`
      INSERT INTO nav_nodes (id, profile_id, key, label, icon, type, url, parent_id, "order", module_key, is_visible)
      VALUES
        (uuid_generate_v4(), '${profileId}', 'settings.profile', 'Profile', 'user', 'module', '/settings/profile', '${settingsParentId}', 0, NULL, true),
        (uuid_generate_v4(), '${profileId}', 'settings.security', 'Security', 'lock', 'module', '/settings/security', '${settingsParentId}', 1, NULL, true),
        (uuid_generate_v4(), '${profileId}', 'settings.themes', 'Themes', 'palette', 'module', '/settings/themes', '${settingsParentId}', 2, NULL, true),
        (uuid_generate_v4(), '${profileId}', 'settings.mfa', 'Two-Factor Auth', 'smartphone', 'module', '/settings/mfa-setup', '${settingsParentId}', 3, NULL, true),
        (uuid_generate_v4(), '${profileId}', 'settings.delegations', 'Delegations', 'user-check', 'module', '/settings/delegations', '${settingsParentId}', 4, NULL, true)
      ON CONFLICT DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const profileId = 'a0000000-0000-0000-0000-000000000001';

    // Delete all nav nodes for this profile
    await queryRunner.query(`
      DELETE FROM nav_nodes WHERE profile_id = '${profileId}'
    `);

    // Delete the profile
    await queryRunner.query(`
      DELETE FROM nav_profiles WHERE id = '${profileId}'
    `);
  }
}
