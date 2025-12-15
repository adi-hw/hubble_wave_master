import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Add Studio Navigation for New Pages
 *
 * Adds navigation items for:
 * - Collections (Schema Engine)
 * - Views
 * - Commitments (SLA/OLA)
 * - Import/Export
 * - AVA Governance
 * - Enterprise features
 * - Users management
 * - Analytics & Reports
 */
export class AddStudioNavigation1792000000000 implements MigrationInterface {
  name = 'AddStudioNavigation1792000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Insert new modules for Studio/Admin pages - using unique names for each
    await queryRunner.query(`
      INSERT INTO modules (key, name, slug, label, application_key, type, target_config, icon, owner_type, is_active, sort_order)
      VALUES
        -- Studio - Schema Engine
        ('studio.collections.list', 'Studio Collections List', 'studio-collections', 'Collections', 'studio', 'list',
          '{"route": "/studio/collections"}',
          'Database', 'platform', true, 5),
        ('studio.views.list', 'Studio Views List', 'studio-views', 'Views', 'studio', 'list',
          '{"route": "/studio/views"}',
          'Layout', 'platform', true, 15),
        ('studio.properties.list', 'Studio Properties List', 'studio-properties', 'Properties', 'studio', 'list',
          '{"route": "/studio/properties"}',
          'ListTree', 'platform', true, 8),

        -- Studio - Automations
        ('studio.automations.rules', 'Studio Business Rules', 'studio-business-rules', 'Business Rules', 'studio', 'list',
          '{"route": "/admin/automations/rules"}',
          'FileCode2', 'platform', true, 42),
        ('studio.automations.workflows', 'Studio Workflows', 'studio-workflows', 'Workflows', 'studio', 'list',
          '{"route": "/admin/automations/workflows"}',
          'GitBranch', 'platform', true, 44),
        ('studio.automations.runs', 'Studio Workflow Runs', 'studio-workflow-runs', 'Workflow Runs', 'studio', 'list',
          '{"route": "/admin/automations/runs"}',
          'Play', 'platform', true, 46),

        -- Studio - Commitments (SLA/OLA)
        ('studio.commitments.list', 'Studio Commitments List', 'studio-commitments', 'Commitments', 'studio', 'list',
          '{"route": "/studio/commitments"}',
          'Timer', 'platform', true, 60),

        -- Studio - Import/Export
        ('studio.import', 'Studio Data Import', 'studio-import', 'Import', 'studio', 'custom',
          '{"route": "/studio/import"}',
          'Upload', 'platform', true, 70),
        ('studio.export', 'Studio Data Export', 'studio-export', 'Export', 'studio', 'custom',
          '{"route": "/studio/export"}',
          'Download', 'platform', true, 72),
        ('studio.connections', 'Studio Connections', 'studio-connections', 'Connections', 'studio', 'list',
          '{"route": "/studio/connections"}',
          'Link2', 'platform', true, 74),

        -- Admin - Users
        ('admin.users.list.v2', 'Admin Users Management', 'admin-users-v2', 'Users', 'admin', 'list',
          '{"route": "/studio/users"}',
          'Users', 'platform', true, 5),
        ('admin.users.invite', 'Admin User Invite', 'admin-users-invite', 'Invite User', 'admin', 'form',
          '{"route": "/studio/users/invite"}',
          'UserPlus', 'platform', true, 6),

        -- Admin - AVA Governance
        ('admin.ava.permissions', 'Admin AVA Permissions', 'admin-ava-permissions', 'AVA Permissions', 'admin', 'custom',
          '{"route": "/admin/ava/permissions"}',
          'Bot', 'platform', true, 82),
        ('admin.ava.audit', 'Admin AVA Audit Trail', 'admin-ava-audit', 'AVA Audit Trail', 'admin', 'list',
          '{"route": "/admin/ava/audit"}',
          'FileSearch', 'platform', true, 84),

        -- Admin - Enterprise
        ('admin.enterprise.audit', 'Admin Enterprise Audit Logs', 'admin-audit-logs', 'Audit Logs', 'admin', 'list',
          '{"route": "/admin/enterprise/audit"}',
          'History', 'platform', true, 92),
        ('admin.enterprise.compliance', 'Admin Compliance Dashboard', 'admin-compliance', 'Compliance', 'admin', 'dashboard',
          '{"route": "/admin/enterprise/compliance"}',
          'ShieldCheck', 'platform', true, 94),
        ('admin.enterprise.sso', 'Admin SSO Configuration', 'admin-sso', 'SSO Configuration', 'admin', 'custom',
          '{"route": "/admin/enterprise/sso"}',
          'Key', 'platform', true, 96),

        -- Admin - Integrations
        ('admin.integrations.list', 'Admin Integrations List', 'admin-integrations', 'Integrations', 'admin', 'list',
          '{"route": "/admin/integrations"}',
          'Puzzle', 'platform', true, 100),

        -- Admin - Analytics & Reports
        ('admin.analytics.dashboard', 'Admin Analytics Dashboard', 'admin-analytics', 'Analytics', 'admin', 'dashboard',
          '{"route": "/admin/analytics"}',
          'BarChart3', 'platform', true, 110),
        ('admin.reports.list', 'Admin Reports List', 'admin-reports', 'Reports', 'admin', 'list',
          '{"route": "/admin/reports"}',
          'FileBarChart', 'platform', true, 112),

        -- Admin - Modules
        ('admin.modules.list', 'Admin Modules List', 'admin-modules', 'Modules', 'admin', 'list',
          '{"route": "/admin/modules"}',
          'Package', 'platform', true, 120),

        -- Portal
        ('portal.home', 'Portal Home Page', 'portal-home', 'Service Portal', 'portal', 'dashboard',
          '{"route": "/portal"}',
          'Home', 'platform', true, 10),
        ('portal.catalog', 'Portal Service Catalog', 'portal-catalog', 'Service Catalog', 'portal', 'list',
          '{"route": "/portal/catalog"}',
          'ShoppingCart', 'platform', true, 20),
        ('portal.my-items', 'Portal My Items', 'portal-my-items', 'My Items', 'portal', 'list',
          '{"route": "/portal/my-items"}',
          'Inbox', 'platform', true, 30),
        ('portal.knowledge', 'Portal Knowledge Base', 'portal-knowledge', 'Knowledge Base', 'portal', 'list',
          '{"route": "/portal/knowledge"}',
          'BookOpen', 'platform', true, 40)
      ON CONFLICT (slug) DO UPDATE SET
        key = EXCLUDED.key,
        name = EXCLUDED.name,
        label = EXCLUDED.label,
        application_key = EXCLUDED.application_key,
        type = EXCLUDED.type,
        target_config = EXCLUDED.target_config,
        icon = EXCLUDED.icon,
        owner_type = EXCLUDED.owner_type,
        is_active = EXCLUDED.is_active,
        sort_order = EXCLUDED.sort_order;
    `);

    // Update navigation template with new structure
    await queryRunner.query(`
      UPDATE nav_templates
      SET nav_structure = $navjson$[
        {
          "key": "favorites",
          "label": "Favorites",
          "icon": "Star",
          "type": "smart_group",
          "smartGroupType": "favorites",
          "order": 0
        },
        {
          "key": "recent",
          "label": "Recently Viewed",
          "icon": "Clock",
          "type": "smart_group",
          "smartGroupType": "recent",
          "order": 1
        },
        {
          "key": "portal",
          "label": "Service Portal",
          "icon": "Home",
          "type": "group",
          "order": 5,
          "children": [
            {"key": "portal.home", "label": "Portal Home", "icon": "Home", "type": "module", "moduleKey": "portal.home", "order": 0},
            {"key": "portal.catalog", "label": "Service Catalog", "icon": "ShoppingCart", "type": "module", "moduleKey": "portal.catalog", "order": 10},
            {"key": "portal.my-items", "label": "My Items", "icon": "Inbox", "type": "module", "moduleKey": "portal.my-items", "order": 20},
            {"key": "portal.knowledge", "label": "Knowledge Base", "icon": "BookOpen", "type": "module", "moduleKey": "portal.knowledge", "order": 30}
          ]
        },
        {
          "key": "eam",
          "label": "Asset Management",
          "icon": "Box",
          "type": "group",
          "order": 10,
          "children": [
            {"key": "eam.assets", "label": "Assets", "icon": "Box", "type": "module", "moduleKey": "eam.asset.list", "order": 0},
            {"key": "eam.field_demo", "label": "Field Type Demo", "icon": "FlaskConical", "type": "module", "moduleKey": "eam.field_demo.list", "order": 10}
          ]
        },
        {
          "key": "studio",
          "label": "Studio",
          "icon": "Paintbrush",
          "type": "group",
          "order": 100,
          "visibility": {"rolesAny": ["admin", "tenant_admin", "developer"]},
          "children": [
            {
              "key": "studio.schema",
              "label": "Schema",
              "icon": "Database",
              "type": "group",
              "order": 0,
              "children": [
                {"key": "studio.collections", "label": "Collections", "icon": "Database", "type": "module", "moduleKey": "studio.collections.list", "order": 0},
                {"key": "studio.properties", "label": "Properties", "icon": "ListTree", "type": "module", "moduleKey": "studio.properties.list", "order": 5},
                {"key": "studio.views", "label": "Views", "icon": "Layout", "type": "module", "moduleKey": "studio.views.list", "order": 10},
                {"key": "studio.tables", "label": "Tables (Legacy)", "icon": "Table2", "type": "module", "moduleKey": "studio.tables.list", "order": 90}
              ]
            },
            {
              "key": "studio.automations",
              "label": "Automations",
              "icon": "Zap",
              "type": "group",
              "order": 20,
              "children": [
                {"key": "studio.business-rules", "label": "Business Rules", "icon": "FileCode2", "type": "module", "moduleKey": "studio.automations.rules", "order": 0},
                {"key": "studio.workflows", "label": "Workflows", "icon": "GitBranch", "type": "module", "moduleKey": "studio.automations.workflows", "order": 10},
                {"key": "studio.workflow-runs", "label": "Workflow Runs", "icon": "Play", "type": "module", "moduleKey": "studio.automations.runs", "order": 20}
              ]
            },
            {
              "key": "studio.commitments",
              "label": "Commitments",
              "icon": "Timer",
              "type": "module",
              "moduleKey": "studio.commitments.list",
              "order": 30
            },
            {
              "key": "studio.data",
              "label": "Data",
              "icon": "FolderSync",
              "type": "group",
              "order": 40,
              "children": [
                {"key": "studio.import", "label": "Import", "icon": "Upload", "type": "module", "moduleKey": "studio.import", "order": 0},
                {"key": "studio.export", "label": "Export", "icon": "Download", "type": "module", "moduleKey": "studio.export", "order": 10},
                {"key": "studio.connections", "label": "Connections", "icon": "Link2", "type": "module", "moduleKey": "studio.connections", "order": 20}
              ]
            }
          ]
        },
        {
          "key": "admin",
          "label": "Administration",
          "icon": "Settings",
          "type": "group",
          "order": 110,
          "visibility": {"rolesAny": ["admin", "tenant_admin"]},
          "children": [
            {"key": "admin.users", "label": "Users", "icon": "Users", "type": "module", "moduleKey": "admin.users.list.v2", "order": 0},
            {
              "key": "admin.ava",
              "label": "AVA Governance",
              "icon": "Bot",
              "type": "group",
              "order": 10,
              "children": [
                {"key": "admin.ava.permissions", "label": "AVA Permissions", "icon": "ShieldCheck", "type": "module", "moduleKey": "admin.ava.permissions", "order": 0},
                {"key": "admin.ava.audit", "label": "AVA Audit Trail", "icon": "FileSearch", "type": "module", "moduleKey": "admin.ava.audit", "order": 10}
              ]
            },
            {
              "key": "admin.enterprise",
              "label": "Enterprise",
              "icon": "Building2",
              "type": "group",
              "order": 20,
              "children": [
                {"key": "admin.audit", "label": "Audit Logs", "icon": "History", "type": "module", "moduleKey": "admin.enterprise.audit", "order": 0},
                {"key": "admin.compliance", "label": "Compliance", "icon": "ShieldCheck", "type": "module", "moduleKey": "admin.enterprise.compliance", "order": 10},
                {"key": "admin.sso", "label": "SSO Configuration", "icon": "Key", "type": "module", "moduleKey": "admin.enterprise.sso", "order": 20}
              ]
            },
            {"key": "admin.integrations", "label": "Integrations", "icon": "Puzzle", "type": "module", "moduleKey": "admin.integrations.list", "order": 30},
            {"key": "admin.modules", "label": "Modules", "icon": "Package", "type": "module", "moduleKey": "admin.modules.list", "order": 40},
            {
              "key": "admin.insights",
              "label": "Insights",
              "icon": "BarChart3",
              "type": "group",
              "order": 50,
              "children": [
                {"key": "admin.analytics", "label": "Analytics", "icon": "BarChart3", "type": "module", "moduleKey": "admin.analytics.dashboard", "order": 0},
                {"key": "admin.reports", "label": "Reports", "icon": "FileBarChart", "type": "module", "moduleKey": "admin.reports.list", "order": 10}
              ]
            }
          ]
        }
      ]$navjson$::jsonb,
      version = '2.0.0'
      WHERE key = 'default_eam';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove newly added modules
    await queryRunner.query(`
      DELETE FROM modules WHERE key IN (
        'studio.collections.list', 'studio.views.list', 'studio.properties.list',
        'studio.automations.rules', 'studio.automations.workflows', 'studio.automations.runs',
        'studio.commitments.list', 'studio.import', 'studio.export', 'studio.connections',
        'admin.users.list.v2', 'admin.users.invite',
        'admin.ava.permissions', 'admin.ava.audit',
        'admin.enterprise.audit', 'admin.enterprise.compliance', 'admin.enterprise.sso',
        'admin.integrations.list', 'admin.analytics.dashboard', 'admin.reports.list', 'admin.modules.list',
        'portal.home', 'portal.catalog', 'portal.my-items', 'portal.knowledge'
      );
    `);

    // Revert navigation template to v1
    await queryRunner.query(`
      UPDATE nav_templates SET version = '1.0.0' WHERE key = 'default_eam';
    `);
  }
}
