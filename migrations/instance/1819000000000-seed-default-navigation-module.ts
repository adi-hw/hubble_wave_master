import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedDefaultNavigationModule1819000000000 implements MigrationInterface {
  name = 'SeedDefaultNavigationModule1819000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const layout = {
      nodes: [
        {
          key: 'home',
          type: 'module',
          label: 'Home',
          icon: 'home',
          route: '/home',
        },
        {
          key: 'studio',
          type: 'group',
          label: 'Studio',
          icon: 'settings-2',
          children: [
            {
              key: 'studio.users',
              type: 'module',
              label: 'Users',
              icon: 'users',
              route: '/studio/users',
            },
            {
              key: 'studio.groups',
              type: 'module',
              label: 'Groups',
              icon: 'users-round',
              route: '/studio/groups',
            },
            {
              key: 'studio.roles',
              type: 'module',
              label: 'Roles & Permissions',
              icon: 'shield',
              route: '/studio/roles',
            },
            {
              key: 'studio.collections',
              type: 'module',
              label: 'Collections',
              icon: 'database',
              route: '/studio/collections',
            },
            {
              key: 'studio.views',
              type: 'module',
              label: 'Views',
              icon: 'layout',
              route: '/studio/views',
            },
            {
              key: 'studio.navigation',
              type: 'module',
              label: 'Navigation',
              icon: 'menu',
              route: '/studio/navigation',
            },
            {
              key: 'studio.sso',
              type: 'module',
              label: 'SSO Configuration',
              icon: 'key-round',
              route: '/studio/sso',
            },
            {
              key: 'studio.ldap',
              type: 'module',
              label: 'LDAP Configuration',
              icon: 'server',
              route: '/studio/ldap',
            },
            {
              key: 'studio.audit',
              type: 'module',
              label: 'Audit Logs',
              icon: 'scroll-text',
              route: '/studio/audit',
            },
          ],
        },
        {
          key: 'automation',
          type: 'group',
          label: 'Automation',
          icon: 'zap',
          children: [
            {
              key: 'automation.rules',
              type: 'module',
              label: 'Automation Rules',
              icon: 'zap',
              route: '/automation',
            },
            {
              key: 'automation.process-flows',
              type: 'module',
              label: 'Process Flows',
              icon: 'git-branch',
              route: '/process-flows',
            },
          ],
        },
        {
          key: 'integrations',
          type: 'group',
          label: 'Integrations',
          icon: 'plug',
          children: [
            {
              key: 'integrations.api',
              type: 'module',
              label: 'API Explorer',
              icon: 'code',
              route: '/integrations/api',
            },
            {
              key: 'integrations.webhooks',
              type: 'module',
              label: 'Webhooks',
              icon: 'webhook',
              route: '/integrations/webhooks',
            },
            {
              key: 'integrations.import-export',
              type: 'module',
              label: 'Import/Export',
              icon: 'arrow-left-right',
              route: '/integrations/import-export',
            },
            {
              key: 'integrations.marketplace',
              type: 'module',
              label: 'Marketplace',
              icon: 'store',
              route: '/integrations/marketplace',
            },
          ],
        },
        {
          key: 'ai',
          type: 'group',
          label: 'AVA Intelligence',
          icon: 'sparkles',
          children: [
            {
              key: 'ai.query',
              type: 'module',
              label: 'Chat with AVA',
              icon: 'message-circle',
              route: '/ai/query',
            },
            {
              key: 'ai.reports',
              type: 'module',
              label: 'AI Reports',
              icon: 'file-bar-chart',
              route: '/ai/reports',
            },
            {
              key: 'ai.predictive-ops',
              type: 'module',
              label: 'Predictive Operations',
              icon: 'trending-up',
              route: '/ai/predictive-ops',
            },
            {
              key: 'ai.digital-twins',
              type: 'module',
              label: 'Digital Twins',
              icon: 'copy',
              route: '/ai/digital-twins',
            },
            {
              key: 'ai.self-healing',
              type: 'module',
              label: 'Self-Healing',
              icon: 'heart-pulse',
              route: '/ai/self-healing',
            },
            {
              key: 'ai.docs',
              type: 'module',
              label: 'Living Documentation',
              icon: 'book-open',
              route: '/ai/docs',
            },
            {
              key: 'ai.agile',
              type: 'module',
              label: 'Agile Development',
              icon: 'kanban',
              route: '/ai/agile',
            },
            {
              key: 'ai.app-builder',
              type: 'module',
              label: 'App Builder',
              icon: 'blocks',
              route: '/ai/app-builder',
            },
            {
              key: 'ai.upgrade',
              type: 'module',
              label: 'Upgrade Assistant',
              icon: 'arrow-up-circle',
              route: '/ai/upgrade',
            },
          ],
        },
        {
          key: 'notifications',
          type: 'module',
          label: 'Notifications',
          icon: 'bell',
          route: '/notifications',
        },
        {
          key: 'settings',
          type: 'group',
          label: 'Settings',
          icon: 'settings',
          children: [
            {
              key: 'settings.profile',
              type: 'module',
              label: 'Profile',
              icon: 'user',
              route: '/settings/profile',
            },
            {
              key: 'settings.security',
              type: 'module',
              label: 'Security',
              icon: 'lock',
              route: '/settings/security',
            },
            {
              key: 'settings.themes',
              type: 'module',
              label: 'Themes',
              icon: 'palette',
              route: '/settings/themes',
            },
            {
              key: 'settings.mfa',
              type: 'module',
              label: 'Two-Factor Auth',
              icon: 'smartphone',
              route: '/settings/mfa-setup',
            },
            {
              key: 'settings.delegations',
              type: 'module',
              label: 'Delegations',
              icon: 'user-check',
              route: '/settings/delegations',
            },
          ],
        },
      ],
    };

    const moduleRows = await queryRunner.query(
      `
        INSERT INTO navigation_modules (code, name, description, metadata, is_active)
        VALUES ($1, $2, $3, '{}'::jsonb, true)
        ON CONFLICT (code) DO UPDATE
          SET name = EXCLUDED.name,
              description = EXCLUDED.description,
              is_active = EXCLUDED.is_active,
              updated_at = NOW()
        RETURNING id
      `,
      ['primary', 'Primary Navigation', 'Default navigation module']
    );

    const moduleId = moduleRows[0]?.id as string | undefined;
    if (!moduleId) {
      return;
    }

    const publishedRows = await queryRunner.query(
      `
        SELECT id
        FROM navigation_module_revisions
        WHERE navigation_module_id = $1
          AND status = 'published'
        ORDER BY revision DESC
        LIMIT 1
      `,
      [moduleId]
    );

    if (publishedRows.length === 0) {
      await queryRunner.query(
        `
          INSERT INTO navigation_module_revisions
            (navigation_module_id, revision, status, layout, published_at)
          VALUES ($1, 1, 'published', $2, NOW())
        `,
        [moduleId, layout]
      );
    }

    const variantRows = await queryRunner.query(
      `
        SELECT id
        FROM navigation_variants
        WHERE navigation_module_id = $1
          AND scope = 'system'
        LIMIT 1
      `,
      [moduleId]
    );

    if (variantRows.length === 0) {
      await queryRunner.query(
        `
          INSERT INTO navigation_variants
            (navigation_module_id, scope, scope_key, priority, is_active)
          VALUES ($1, 'system', NULL, 100, true)
        `,
        [moduleId]
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const moduleRows = await queryRunner.query(
      `SELECT id FROM navigation_modules WHERE code = $1`,
      ['primary']
    );

    const moduleId = moduleRows[0]?.id as string | undefined;
    if (!moduleId) {
      return;
    }

    await queryRunner.query(
      `DELETE FROM navigation_variants WHERE navigation_module_id = $1`,
      [moduleId]
    );
    await queryRunner.query(
      `DELETE FROM navigation_module_revisions WHERE navigation_module_id = $1`,
      [moduleId]
    );
    await queryRunner.query(
      `DELETE FROM navigation_modules WHERE id = $1`,
      [moduleId]
    );
  }
}
