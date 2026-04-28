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

    const profileId = 'a0000000-0000-0000-0000-000000000001';
    await queryRunner.query(
      `INSERT INTO nav_profiles (id, code, name, description, scope, is_default, is_active)
       VALUES ($1, 'default', 'Default Navigation', 'Default navigation profile for all users', 'global', true, true)
       ON CONFLICT (code) DO UPDATE SET
         name = EXCLUDED.name,
         description = EXCLUDED.description,
         is_default = EXCLUDED.is_default,
         is_active = EXCLUDED.is_active`,
      [profileId]
    );

    // =========================================================================
    // STEP 2: Create navigation nodes using uuid_generate_v4()
    // =========================================================================

    // ─────────────────────────────────────────────────────────────────────────
    // ROOT LEVEL ITEMS
    // ─────────────────────────────────────────────────────────────────────────

    // Home
    await queryRunner.query(
      `INSERT INTO nav_nodes (id, profile_id, key, label, icon, type, url, parent_id, "order", module_key, is_visible)
       VALUES (uuid_generate_v4(), $1, 'home', 'Home', 'home', 'module', '/home', NULL, 0, NULL, true)
       ON CONFLICT DO NOTHING`,
      [profileId]
    );

    // ─────────────────────────────────────────────────────────────────────────
    // STUDIO GROUP (Admin)
    // ─────────────────────────────────────────────────────────────────────────

    // Insert Studio group and get its ID
    const studioParentId = 'b0000001-0001-0001-0001-000000000010';
    await queryRunner.query(
      `INSERT INTO nav_nodes (id, profile_id, key, label, icon, type, url, parent_id, "order", module_key, is_visible)
       VALUES ($1, $2, 'studio', 'Studio', 'settings-2', 'group', NULL, NULL, 10, NULL, true)
       ON CONFLICT DO NOTHING`,
      [studioParentId, profileId]
    );

    // Studio children
    await queryRunner.query(
      `INSERT INTO nav_nodes (id, profile_id, key, label, icon, type, url, parent_id, "order", module_key, is_visible)
       VALUES
         (uuid_generate_v4(), $1, 'studio.users', 'Users', 'users', 'module', '/studio/users', $2, 0, NULL, true),
         (uuid_generate_v4(), $1, 'studio.groups', 'Groups', 'users-round', 'module', '/studio/groups', $2, 1, NULL, true),
         (uuid_generate_v4(), $1, 'studio.roles', 'Roles & Permissions', 'shield', 'module', '/studio/roles', $2, 2, NULL, true),
         (uuid_generate_v4(), $1, 'studio.collections', 'Collections', 'database', 'module', '/studio/collections', $2, 3, NULL, true),
         (uuid_generate_v4(), $1, 'studio.navigation', 'Navigation', 'menu', 'module', '/studio/navigation', $2, 4, NULL, true),
         (uuid_generate_v4(), $1, 'studio.sso', 'SSO Configuration', 'key-round', 'module', '/studio/sso', $2, 5, NULL, true),
         (uuid_generate_v4(), $1, 'studio.ldap', 'LDAP Configuration', 'server', 'module', '/studio/ldap', $2, 6, NULL, true),
         (uuid_generate_v4(), $1, 'studio.audit', 'Audit Logs', 'scroll-text', 'module', '/studio/audit', $2, 7, NULL, true)
       ON CONFLICT DO NOTHING`,
      [profileId, studioParentId]
    );

    // ─────────────────────────────────────────────────────────────────────────
    // AUTOMATION GROUP
    // ─────────────────────────────────────────────────────────────────────────

    const automationParentId = 'b0000001-0001-0001-0001-000000000020';
    await queryRunner.query(
      `INSERT INTO nav_nodes (id, profile_id, key, label, icon, type, url, parent_id, "order", module_key, is_visible)
       VALUES ($1, $2, 'automation', 'Automation', 'zap', 'group', NULL, NULL, 20, NULL, true)
       ON CONFLICT DO NOTHING`,
      [automationParentId, profileId]
    );

    await queryRunner.query(
      `INSERT INTO nav_nodes (id, profile_id, key, label, icon, type, url, parent_id, "order", module_key, is_visible)
       VALUES
         (uuid_generate_v4(), $1, 'automation.rules', 'Automation Rules', 'zap', 'module', '/automation', $2, 0, NULL, true),
         (uuid_generate_v4(), $1, 'automation.process-flows', 'Process Flows', 'git-branch', 'module', '/process-flows', $2, 1, NULL, true)
       ON CONFLICT DO NOTHING`,
      [profileId, automationParentId]
    );

    // ─────────────────────────────────────────────────────────────────────────
    // INTEGRATIONS GROUP
    // ─────────────────────────────────────────────────────────────────────────

    const integrationsParentId = 'b0000001-0001-0001-0001-000000000030';
    await queryRunner.query(
      `INSERT INTO nav_nodes (id, profile_id, key, label, icon, type, url, parent_id, "order", module_key, is_visible)
       VALUES ($1, $2, 'integrations', 'Integrations', 'plug', 'group', NULL, NULL, 30, NULL, true)
       ON CONFLICT DO NOTHING`,
      [integrationsParentId, profileId]
    );

    await queryRunner.query(
      `INSERT INTO nav_nodes (id, profile_id, key, label, icon, type, url, parent_id, "order", module_key, is_visible)
       VALUES
         (uuid_generate_v4(), $1, 'integrations.api', 'API Explorer', 'code', 'module', '/integrations/api', $2, 0, NULL, true),
         (uuid_generate_v4(), $1, 'integrations.webhooks', 'Webhooks', 'webhook', 'module', '/integrations/webhooks', $2, 1, NULL, true),
         (uuid_generate_v4(), $1, 'integrations.import-export', 'Import/Export', 'arrow-left-right', 'module', '/integrations/import-export', $2, 2, NULL, true),
         (uuid_generate_v4(), $1, 'integrations.marketplace', 'Marketplace', 'store', 'module', '/integrations/marketplace', $2, 3, NULL, true)
       ON CONFLICT DO NOTHING`,
      [profileId, integrationsParentId]
    );

    // ─────────────────────────────────────────────────────────────────────────
    // AI / AVA GROUP (Phase 7 Revolutionary Features)
    // ─────────────────────────────────────────────────────────────────────────

    const aiParentId = 'b0000001-0001-0001-0001-000000000040';
    await queryRunner.query(
      `INSERT INTO nav_nodes (id, profile_id, key, label, icon, type, url, parent_id, "order", module_key, is_visible)
       VALUES ($1, $2, 'ai', 'AVA Intelligence', 'sparkles', 'group', NULL, NULL, 40, NULL, true)
       ON CONFLICT DO NOTHING`,
      [aiParentId, profileId]
    );

    await queryRunner.query(
      `INSERT INTO nav_nodes (id, profile_id, key, label, icon, type, url, parent_id, "order", module_key, is_visible)
       VALUES
         (uuid_generate_v4(), $1, 'ai.query', 'Chat with AVA', 'message-circle', 'module', '/ai/query', $2, 0, NULL, true),
         (uuid_generate_v4(), $1, 'ai.reports', 'AI Reports', 'file-bar-chart', 'module', '/ai/reports', $2, 1, NULL, true),
         (uuid_generate_v4(), $1, 'ai.predictive-ops', 'Predictive Operations', 'trending-up', 'module', '/ai/predictive-ops', $2, 2, NULL, true),
         (uuid_generate_v4(), $1, 'ai.digital-twins', 'Digital Twins', 'copy', 'module', '/ai/digital-twins', $2, 3, NULL, true),
         (uuid_generate_v4(), $1, 'ai.self-healing', 'Self-Healing', 'heart-pulse', 'module', '/ai/self-healing', $2, 4, NULL, true),
         (uuid_generate_v4(), $1, 'ai.docs', 'Living Documentation', 'book-open', 'module', '/ai/docs', $2, 5, NULL, true),
         (uuid_generate_v4(), $1, 'ai.agile', 'Agile Development', 'kanban', 'module', '/ai/agile', $2, 6, NULL, true),
         (uuid_generate_v4(), $1, 'ai.app-builder', 'App Builder', 'blocks', 'module', '/ai/app-builder', $2, 7, NULL, true),
         (uuid_generate_v4(), $1, 'ai.upgrade', 'Upgrade Assistant', 'arrow-up-circle', 'module', '/ai/upgrade', $2, 8, NULL, true)
       ON CONFLICT DO NOTHING`,
      [profileId, aiParentId]
    );

    // ─────────────────────────────────────────────────────────────────────────
    // NOTIFICATIONS
    // ─────────────────────────────────────────────────────────────────────────

    await queryRunner.query(
      `INSERT INTO nav_nodes (id, profile_id, key, label, icon, type, url, parent_id, "order", module_key, is_visible)
       VALUES (uuid_generate_v4(), $1, 'notifications', 'Notifications', 'bell', 'module', '/notifications', NULL, 50, NULL, true)
       ON CONFLICT DO NOTHING`,
      [profileId]
    );

    // ─────────────────────────────────────────────────────────────────────────
    // SETTINGS GROUP
    // ─────────────────────────────────────────────────────────────────────────

    const settingsParentId = 'b0000001-0001-0001-0001-000000000060';
    await queryRunner.query(
      `INSERT INTO nav_nodes (id, profile_id, key, label, icon, type, url, parent_id, "order", module_key, is_visible)
       VALUES ($1, $2, 'settings', 'Settings', 'settings', 'group', NULL, NULL, 60, NULL, true)
       ON CONFLICT DO NOTHING`,
      [settingsParentId, profileId]
    );

    await queryRunner.query(
      `INSERT INTO nav_nodes (id, profile_id, key, label, icon, type, url, parent_id, "order", module_key, is_visible)
       VALUES
         (uuid_generate_v4(), $1, 'settings.profile', 'Profile', 'user', 'module', '/settings/profile', $2, 0, NULL, true),
         (uuid_generate_v4(), $1, 'settings.security', 'Security', 'lock', 'module', '/settings/security', $2, 1, NULL, true),
         (uuid_generate_v4(), $1, 'settings.themes', 'Themes', 'palette', 'module', '/settings/themes', $2, 2, NULL, true),
         (uuid_generate_v4(), $1, 'settings.mfa', 'Two-Factor Auth', 'smartphone', 'module', '/settings/mfa-setup', $2, 3, NULL, true),
         (uuid_generate_v4(), $1, 'settings.delegations', 'Delegations', 'user-check', 'module', '/settings/delegations', $2, 4, NULL, true)
       ON CONFLICT DO NOTHING`,
      [profileId, settingsParentId]
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const profileId = 'a0000000-0000-0000-0000-000000000001';

    await queryRunner.query(
      `DELETE FROM nav_nodes WHERE profile_id = $1`,
      [profileId]
    );

    await queryRunner.query(
      `DELETE FROM nav_profiles WHERE id = $1`,
      [profileId]
    );
  }
}
