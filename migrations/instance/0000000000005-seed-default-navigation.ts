import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Seed the default navigation profile and the 35 canonical nav nodes.
 *
 * The default navigation profile (id: a0000000-0000-0000-0000-000000000001,
 * code: 'default', scope: 'global', is_default: true) is the platform-level
 * nav manifest that every user sees before any role-specific or personal
 * overrides are applied.
 *
 * Nav nodes seeded represent the deduped post-Prelude navigation state
 * (after migration 1943100000000-dedup-nav-nodes.ts ran on the live instance).
 * Groups (type='group') parent leaf module nodes (type='module').
 *
 * Parent groups must be inserted before their children due to the FK constraint
 * FK_nav_nodes_parent. They are inserted first in this migration.
 *
 * Idempotent: ON CONFLICT (id) DO NOTHING for nav_profiles; the nav_nodes
 * table does not have a unique constraint on key+profile_id, so we use
 * ON CONFLICT (id) DO NOTHING — the fixed UUIDs make duplicate detection
 * reliable.
 *
 * down() throws — navigation is structural boot-time data; removing it
 * would render the platform unnavigable. Forward-only is the only safe path.
 */
export class SeedDefaultNavigation0000000000005 implements MigrationInterface {
  // Timestamp sentinel 1000000000005 — runs last among the structural seeds;
  // requires identity.nav_profiles table from the baseline and the admin-role
  // row from seed-system-roles (1000000000001).
  name = 'SeedDefaultNavigation1000000000005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // -------------------------------------------------------------------------
    // Navigation profile — the single global default profile all users share.
    // The UUID (a0000000-...) is a well-known sentinel used throughout the
    // platform; it is referenced by role-specific nav patches.
    // -------------------------------------------------------------------------
    await queryRunner.query(`
      INSERT INTO identity.nav_profiles
        (id, code, name, scope, is_default, is_system, priority, is_active, is_locked)
      VALUES
        ('a0000000-0000-0000-0000-000000000001',
         'default', 'Default Navigation', 'global',
         true, false, 100, true, false)
      ON CONFLICT (code) DO NOTHING;
    `);

    // -------------------------------------------------------------------------
    // Nav node groups (type='group') — inserted first because leaf module nodes
    // reference them via parent_id FK.
    // -------------------------------------------------------------------------
    await queryRunner.query(`
      INSERT INTO metadata.nav_nodes
        (id, profile_id, key, label, icon, type, module_key, url, parent_id, "order", is_visible)
      VALUES
        ('b0000001-0001-0001-0001-000000000010',
         'a0000000-0000-0000-0000-000000000001',
         'studio', 'Studio', 'settings-2', 'group', NULL, NULL, NULL, 10, true),
        ('b0000001-0001-0001-0001-000000000020',
         'a0000000-0000-0000-0000-000000000001',
         'automation', 'Automation', 'zap', 'group', NULL, NULL, NULL, 20, true),
        ('b0000001-0001-0001-0001-000000000030',
         'a0000000-0000-0000-0000-000000000001',
         'integrations', 'Integrations', 'plug', 'group', NULL, NULL, NULL, 30, true),
        ('b0000001-0001-0001-0001-000000000040',
         'a0000000-0000-0000-0000-000000000001',
         'ai', 'AVA Intelligence', 'sparkles', 'group', NULL, NULL, NULL, 40, true),
        ('b0000001-0001-0001-0001-000000000060',
         'a0000000-0000-0000-0000-000000000001',
         'settings', 'Settings', 'settings', 'group', NULL, NULL, NULL, 60, true)
      ON CONFLICT (id) DO NOTHING;
    `);

    // -------------------------------------------------------------------------
    // Nav node leaf modules (type='module') — top-level singletons and all
    // group children.
    // -------------------------------------------------------------------------
    await queryRunner.query(`
      INSERT INTO metadata.nav_nodes
        (id, profile_id, key, label, icon, type, module_key, url, parent_id, "order", is_visible)
      VALUES
        -- Top-level singletons (no parent)
        ('811947eb-fc98-4c64-a3b8-3e4eb4524b92',
         'a0000000-0000-0000-0000-000000000001',
         'home', 'Home', 'home', 'module', NULL, '/home', NULL, 0, true),
        ('4a1063d6-cc7c-4941-9d08-c070b38c1797',
         'a0000000-0000-0000-0000-000000000001',
         'notifications', 'Notifications', 'bell', 'module', NULL, '/notifications', NULL, 50, true),

        -- Studio group children
        ('e96fd871-9acc-4305-8832-e3c6c2215560',
         'a0000000-0000-0000-0000-000000000001',
         'studio.users', 'Users', 'users', 'module', NULL, '/studio/users',
         'b0000001-0001-0001-0001-000000000010', 0, true),
        ('46efeeba-43da-4d48-a157-749ad95af783',
         'a0000000-0000-0000-0000-000000000001',
         'studio.groups', 'Groups', 'users-round', 'module', NULL, '/studio/groups',
         'b0000001-0001-0001-0001-000000000010', 1, true),
        ('68f67c52-05c9-46f2-8952-859b47cca791',
         'a0000000-0000-0000-0000-000000000001',
         'studio.roles', 'Roles & Permissions', 'shield', 'module', NULL, '/studio/roles',
         'b0000001-0001-0001-0001-000000000010', 2, true),
        ('a74eacd9-5595-4d58-925f-e0c24acabae7',
         'a0000000-0000-0000-0000-000000000001',
         'studio.collections', 'Collections', 'database', 'module', NULL, '/studio/collections',
         'b0000001-0001-0001-0001-000000000010', 3, true),
        ('d0dc98e5-5db6-4c19-ae9c-3448a347a62c',
         'a0000000-0000-0000-0000-000000000001',
         'studio.navigation', 'Navigation', 'menu', 'module', NULL, '/studio/navigation',
         'b0000001-0001-0001-0001-000000000010', 4, true),
        ('7f09915b-3983-4279-8365-0eee63d588db',
         'a0000000-0000-0000-0000-000000000001',
         'studio.sso', 'SSO Configuration', 'key-round', 'module', NULL, '/studio/sso',
         'b0000001-0001-0001-0001-000000000010', 5, true),
        ('b40304fe-c9f0-4455-b3be-cebcb9dd9f3d',
         'a0000000-0000-0000-0000-000000000001',
         'studio.ldap', 'LDAP Configuration', 'server', 'module', NULL, '/studio/ldap',
         'b0000001-0001-0001-0001-000000000010', 6, true),
        ('493f06d5-54ca-4fc7-82dc-005b41f432b1',
         'a0000000-0000-0000-0000-000000000001',
         'studio.audit', 'Audit Logs', 'scroll-text', 'module', NULL, '/studio/audit',
         'b0000001-0001-0001-0001-000000000010', 7, true),

        -- Automation group children
        ('889b21bb-76a1-494b-b80f-b8059fa30c09',
         'a0000000-0000-0000-0000-000000000001',
         'automation.rules', 'Automation Rules', 'zap', 'module', NULL, '/automation',
         'b0000001-0001-0001-0001-000000000020', 0, true),
        ('f2356189-f4c4-4103-97ef-9f102332c0a2',
         'a0000000-0000-0000-0000-000000000001',
         'automation.process-flows', 'Process Flows', 'git-branch', 'module', NULL, '/process-flows',
         'b0000001-0001-0001-0001-000000000020', 1, true),

        -- Integrations group children
        ('bf260d2d-ec61-4e94-a0d8-47314b04d8f0',
         'a0000000-0000-0000-0000-000000000001',
         'integrations.api', 'API Explorer', 'code', 'module', NULL, '/integrations/api',
         'b0000001-0001-0001-0001-000000000030', 0, true),
        ('412b19bb-0052-428f-84e0-ae6703f9591b',
         'a0000000-0000-0000-0000-000000000001',
         'integrations.webhooks', 'Webhooks', 'webhook', 'module', NULL, '/integrations/webhooks',
         'b0000001-0001-0001-0001-000000000030', 1, true),
        ('90903602-57e6-42ca-939d-64c074a93ef7',
         'a0000000-0000-0000-0000-000000000001',
         'integrations.import-export', 'Import/Export', 'arrow-left-right', 'module', NULL, '/integrations/import-export',
         'b0000001-0001-0001-0001-000000000030', 2, true),
        ('08ca16dc-1c92-4a1f-93d2-eb7be99d0e63',
         'a0000000-0000-0000-0000-000000000001',
         'integrations.marketplace', 'Marketplace', 'store', 'module', NULL, '/integrations/marketplace',
         'b0000001-0001-0001-0001-000000000030', 3, true),

        -- AVA Intelligence group children
        ('e7a877f3-75fb-4774-9d78-39547fa1fcb7',
         'a0000000-0000-0000-0000-000000000001',
         'ai.query', 'Chat with AVA', 'message-circle', 'module', NULL, '/ai/query',
         'b0000001-0001-0001-0001-000000000040', 0, true),
        ('82896d53-5ae8-431d-a119-eea3e04aef88',
         'a0000000-0000-0000-0000-000000000001',
         'ai.reports', 'AI Reports', 'file-bar-chart', 'module', NULL, '/ai/reports',
         'b0000001-0001-0001-0001-000000000040', 1, true),
        ('4442012b-d6dc-4aa8-957b-98bd71dc6af4',
         'a0000000-0000-0000-0000-000000000001',
         'ai.predictive-ops', 'Predictive Operations', 'trending-up', 'module', NULL, '/ai/predictive-ops',
         'b0000001-0001-0001-0001-000000000040', 2, true),
        ('d73ac9e4-636a-4c6f-ada2-3e8f41dd9359',
         'a0000000-0000-0000-0000-000000000001',
         'ai.digital-twins', 'Digital Twins', 'copy', 'module', NULL, '/ai/digital-twins',
         'b0000001-0001-0001-0001-000000000040', 3, true),
        ('f6d6c0e4-a7cc-4ec5-b258-d76013b12ada',
         'a0000000-0000-0000-0000-000000000001',
         'ai.self-healing', 'Self-Healing', 'heart-pulse', 'module', NULL, '/ai/self-healing',
         'b0000001-0001-0001-0001-000000000040', 4, true),
        ('a3c70223-7b2a-4e79-8884-375011f3d217',
         'a0000000-0000-0000-0000-000000000001',
         'settings.delegations', 'Delegations', 'user-check', 'module', NULL, '/settings/delegations',
         'b0000001-0001-0001-0001-000000000060', 4, true),
        ('06dd2f9c-17dc-4b72-84d9-4f0331832117',
         'a0000000-0000-0000-0000-000000000001',
         'ai.docs', 'Living Documentation', 'book-open', 'module', NULL, '/ai/docs',
         'b0000001-0001-0001-0001-000000000040', 5, true),
        ('429ff4c1-c526-4144-8464-c0526de875a5',
         'a0000000-0000-0000-0000-000000000001',
         'ai.agile', 'Agile Development', 'kanban', 'module', NULL, '/ai/agile',
         'b0000001-0001-0001-0001-000000000040', 6, true),
        ('7571cdec-6bf7-4867-b8ef-60e7bd44fe5d',
         'a0000000-0000-0000-0000-000000000001',
         'ai.app-builder', 'App Builder', 'blocks', 'module', NULL, '/ai/app-builder',
         'b0000001-0001-0001-0001-000000000040', 7, true),
        ('05be363e-3b36-487f-b86a-2f18e988d56e',
         'a0000000-0000-0000-0000-000000000001',
         'ai.upgrade', 'Upgrade Assistant', 'arrow-up-circle', 'module', NULL, '/ai/upgrade',
         'b0000001-0001-0001-0001-000000000040', 8, true),

        -- Settings group children
        ('1603da39-8546-492f-bf0f-fd7efa337d50',
         'a0000000-0000-0000-0000-000000000001',
         'settings.profile', 'Profile', 'user', 'module', NULL, '/settings/profile',
         'b0000001-0001-0001-0001-000000000060', 0, true),
        ('fbed2739-386f-40e4-934e-c84534dc1bbe',
         'a0000000-0000-0000-0000-000000000001',
         'settings.security', 'Security', 'lock', 'module', NULL, '/settings/security',
         'b0000001-0001-0001-0001-000000000060', 1, true),
        ('5cadfb2a-d8fc-47aa-8ee8-4133972f8d76',
         'a0000000-0000-0000-0000-000000000001',
         'settings.themes', 'Themes', 'palette', 'module', NULL, '/settings/themes',
         'b0000001-0001-0001-0001-000000000060', 2, true),
        ('98c8e64c-58a7-4eb1-8db0-720ea96f4799',
         'a0000000-0000-0000-0000-000000000001',
         'settings.mfa', 'Two-Factor Auth', 'smartphone', 'module', NULL, '/settings/mfa-setup',
         'b0000001-0001-0001-0001-000000000060', 3, true)
      ON CONFLICT (id) DO NOTHING;
    `);
  }

  public async down(): Promise<void> {
    throw new Error('Seed migration is forward-only');
  }
}
