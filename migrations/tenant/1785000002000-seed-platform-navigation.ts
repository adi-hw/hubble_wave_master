import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Seed Platform Navigation
 *
 * Seeds platform-provided navigation data:
 * - Platform modules for EAM, Admin, and Studio applications
 * - Default navigation template
 * - Default navigation profile with items
 *
 * All platform data is marked with owner_type='platform'.
 */
export class SeedPlatformNavigation1785000002000 implements MigrationInterface {
  name = 'SeedPlatformNavigation1785000002000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Update existing modules to add new navigation columns
    // First, update any existing modules that match our slugs
    await queryRunner.query(`
      UPDATE modules SET
        key = 'eam.asset.list',
        label = 'Assets',
        application_key = 'eam',
        type = 'list',
        target_config = '{"table": "app_asset", "route": "/tables/app_asset"}',
        owner_type = 'platform',
        is_active = true
      WHERE slug = 'assets';
    `);

    await queryRunner.query(`
      UPDATE modules SET
        key = 'studio.tables.list',
        label = 'Tables',
        application_key = 'studio',
        type = 'list',
        target_config = '{"route": "/studio/tables"}',
        owner_type = 'platform',
        is_active = true
      WHERE slug = 'tables' OR name = 'Tables';
    `);

    // Insert new modules that don't exist yet
    await queryRunner.query(`
      INSERT INTO modules (key, name, slug, label, application_key, type, target_config, icon, owner_type, is_active, sort_order)
      VALUES
        -- EAM Application Modules
        ('eam.asset.create', 'EAM: Create Asset', 'eam-assets-create', 'Create Asset', 'eam', 'form',
          '{"table": "app_asset", "route": "/tables/app_asset/new"}',
          'Plus', 'platform', true, 11),
        ('eam.field_demo.list', 'EAM: Field Type Demo', 'eam-field-demo', 'Field Type Demo', 'eam', 'list',
          '{"table": "app_field_type_demo", "route": "/tables/app_field_type_demo"}',
          'FlaskConical', 'platform', true, 90),

        -- Admin Application Modules
        ('admin.users.list', 'Admin: Users', 'admin-users', 'Users', 'admin', 'list',
          '{"table": "user_profile", "route": "/admin/users"}',
          'Users', 'platform', true, 10),
        ('admin.roles.list', 'Admin: Roles', 'admin-roles', 'Roles', 'admin', 'list',
          '{"table": "tenant_roles", "route": "/admin/roles"}',
          'Shield', 'platform', true, 20),
        ('admin.groups.list', 'Admin: Groups', 'admin-groups', 'Groups', 'admin', 'list',
          '{"table": "tenant_groups", "route": "/admin/groups"}',
          'Users2', 'platform', true, 30),
        ('admin.navigation.list', 'Admin: Navigation Profiles', 'admin-nav-profiles', 'Navigation Profiles', 'admin', 'list',
          '{"table": "tenant_nav_profiles", "route": "/admin/navigation"}',
          'Navigation', 'platform', true, 40),
        ('admin.acl.table', 'Admin: Table ACLs', 'admin-table-acls', 'Table ACLs', 'admin', 'list',
          '{"table": "tenant_table_acls", "route": "/admin/acl/tables"}',
          'Lock', 'platform', true, 50),
        ('admin.workflows.list', 'Admin: Workflows', 'admin-workflows', 'Workflows', 'admin', 'list',
          '{"table": "workflow_definitions", "route": "/admin/workflows"}',
          'GitBranch', 'platform', true, 60),
        ('admin.business_rules.list', 'Admin: Business Rules', 'admin-business-rules', 'Business Rules', 'admin', 'list',
          '{"table": "business_rule", "route": "/admin/business-rules"}',
          'FileCode', 'platform', true, 70),
        ('admin.notifications.channels', 'Admin: Notification Channels', 'admin-notification-channels', 'Notification Channels', 'admin', 'list',
          '{"table": "notification_channel", "route": "/admin/notifications/channels"}',
          'Bell', 'platform', true, 80),
        ('admin.notifications.templates', 'Admin: Notification Templates', 'admin-notification-templates', 'Notification Templates', 'admin', 'list',
          '{"table": "notification_template", "route": "/admin/notifications/templates"}',
          'FileText', 'platform', true, 81),
        ('admin.audit.list', 'Admin: Audit Log', 'admin-audit-log', 'Audit Log', 'admin', 'list',
          '{"table": "audit_log", "route": "/admin/audit"}',
          'History', 'platform', true, 90),

        -- Studio Application Modules
        ('studio.tables.create', 'Studio: Create Table', 'studio-tables-create', 'Create Table', 'studio', 'wizard',
          '{"route": "/studio/tables/new"}',
          'Plus', 'platform', true, 11),
        ('studio.fields.manage', 'Studio: Field Manager', 'studio-fields', 'Field Manager', 'studio', 'custom',
          '{"route": "/studio/fields"}',
          'Columns', 'platform', true, 20),
        ('studio.forms.list', 'Studio: Form Designer', 'studio-forms', 'Form Designer', 'studio', 'list',
          '{"table": "form_definitions", "route": "/studio/forms"}',
          'LayoutTemplate', 'platform', true, 30),
        ('studio.scripts.list', 'Studio: Scripts', 'studio-scripts', 'Scripts', 'studio', 'list',
          '{"table": "platform_script", "route": "/studio/scripts"}',
          'Code', 'platform', true, 40),
        ('studio.events.list', 'Studio: Events', 'studio-events', 'Events', 'studio', 'list',
          '{"table": "event_definition", "route": "/studio/events"}',
          'Zap', 'platform', true, 50)
      ON CONFLICT (slug) DO UPDATE SET
        key = EXCLUDED.key,
        label = EXCLUDED.label,
        application_key = EXCLUDED.application_key,
        type = EXCLUDED.type,
        target_config = EXCLUDED.target_config,
        icon = EXCLUDED.icon,
        owner_type = EXCLUDED.owner_type,
        is_active = EXCLUDED.is_active,
        sort_order = EXCLUDED.sort_order;
    `);

    // Seed default navigation template
    await queryRunner.query(`
      INSERT INTO nav_templates (key, name, description, category, owner_type, base_applications, nav_structure, version)
      VALUES (
        'default_eam',
        'Default EAM Navigation',
        'Standard navigation structure for EAM users with access to assets, admin, and studio features',
        'Starter',
        'platform',
        ARRAY['eam', 'admin', 'studio'],
        $navjson$[
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
            "key": "eam",
            "label": "Asset Management",
            "icon": "Box",
            "type": "group",
            "order": 10,
            "children": [
              {
                "key": "eam.assets",
                "label": "Assets",
                "icon": "Box",
                "type": "module",
                "moduleKey": "eam.asset.list",
                "order": 0
              },
              {
                "key": "eam.field_demo",
                "label": "Field Type Demo",
                "icon": "FlaskConical",
                "type": "module",
                "moduleKey": "eam.field_demo.list",
                "order": 10
              }
            ]
          },
          {
            "key": "admin",
            "label": "Administration",
            "icon": "Settings",
            "type": "group",
            "order": 100,
            "visibility": {
              "rolesAny": ["admin", "tenant_admin"]
            },
            "children": [
              {
                "key": "admin.identity",
                "label": "Identity & Access",
                "icon": "Shield",
                "type": "group",
                "order": 0,
                "children": [
                  {
                    "key": "admin.users",
                    "label": "Users",
                    "icon": "Users",
                    "type": "module",
                    "moduleKey": "admin.users.list",
                    "order": 0
                  },
                  {
                    "key": "admin.roles",
                    "label": "Roles",
                    "icon": "Shield",
                    "type": "module",
                    "moduleKey": "admin.roles.list",
                    "order": 10
                  },
                  {
                    "key": "admin.groups",
                    "label": "Groups",
                    "icon": "Users2",
                    "type": "module",
                    "moduleKey": "admin.groups.list",
                    "order": 20
                  }
                ]
              },
              {
                "key": "admin.security",
                "label": "Security",
                "icon": "Lock",
                "type": "group",
                "order": 10,
                "children": [
                  {
                    "key": "admin.table_acl",
                    "label": "Table ACLs",
                    "icon": "Lock",
                    "type": "module",
                    "moduleKey": "admin.acl.table",
                    "order": 0
                  },
                  {
                    "key": "admin.navigation",
                    "label": "Navigation Profiles",
                    "icon": "Navigation",
                    "type": "module",
                    "moduleKey": "admin.navigation.list",
                    "order": 10
                  }
                ]
              },
              {
                "key": "admin.automation",
                "label": "Automation",
                "icon": "Zap",
                "type": "group",
                "order": 20,
                "children": [
                  {
                    "key": "admin.workflows",
                    "label": "Workflows",
                    "icon": "GitBranch",
                    "type": "module",
                    "moduleKey": "admin.workflows.list",
                    "order": 0
                  },
                  {
                    "key": "admin.business_rules",
                    "label": "Business Rules",
                    "icon": "FileCode",
                    "type": "module",
                    "moduleKey": "admin.business_rules.list",
                    "order": 10
                  }
                ]
              },
              {
                "key": "admin.notifications",
                "label": "Notifications",
                "icon": "Bell",
                "type": "group",
                "order": 30,
                "children": [
                  {
                    "key": "admin.notification_channels",
                    "label": "Channels",
                    "icon": "Bell",
                    "type": "module",
                    "moduleKey": "admin.notifications.channels",
                    "order": 0
                  },
                  {
                    "key": "admin.notification_templates",
                    "label": "Templates",
                    "icon": "FileText",
                    "type": "module",
                    "moduleKey": "admin.notifications.templates",
                    "order": 10
                  }
                ]
              },
              {
                "key": "admin.audit",
                "label": "Audit Log",
                "icon": "History",
                "type": "module",
                "moduleKey": "admin.audit.list",
                "order": 90
              }
            ]
          },
          {
            "key": "studio",
            "label": "Studio",
            "icon": "Paintbrush",
            "type": "group",
            "order": 110,
            "visibility": {
              "rolesAny": ["admin", "developer"]
            },
            "children": [
              {
                "key": "studio.tables",
                "label": "Tables",
                "icon": "Table2",
                "type": "module",
                "moduleKey": "studio.tables.list",
                "order": 0
              },
              {
                "key": "studio.forms",
                "label": "Form Designer",
                "icon": "LayoutTemplate",
                "type": "module",
                "moduleKey": "studio.forms.list",
                "order": 10
              },
              {
                "key": "studio.scripts",
                "label": "Scripts",
                "icon": "Code",
                "type": "module",
                "moduleKey": "studio.scripts.list",
                "order": 20
              },
              {
                "key": "studio.events",
                "label": "Events",
                "icon": "Zap",
                "type": "module",
                "moduleKey": "studio.events.list",
                "order": 30
              }
            ]
          }
        ]$navjson$::jsonb,
        '1.0.0'
      )
      ON CONFLICT (key) DO UPDATE SET
        nav_structure = EXCLUDED.nav_structure,
        version = EXCLUDED.version;
    `);

    // Create or update the default navigation profile to use the template
    await queryRunner.query(`
      INSERT INTO tenant_nav_profiles (slug, name, description, is_default, is_active, template_key, auto_assign_roles, priority)
      VALUES (
        'default',
        'Default Navigation',
        'Default navigation profile for all users',
        true,
        true,
        'default_eam',
        ARRAY['user', 'admin', 'developer'],
        100
      )
      ON CONFLICT (slug) DO UPDATE SET
        template_key = EXCLUDED.template_key,
        auto_assign_roles = EXCLUDED.auto_assign_roles;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove template_key from default profile
    await queryRunner.query(`
      UPDATE tenant_nav_profiles
      SET template_key = NULL, auto_assign_roles = NULL
      WHERE slug = 'default';
    `);

    // Remove navigation template
    await queryRunner.query(`
      DELETE FROM nav_templates WHERE key = 'default_eam';
    `);

    // Remove platform modules (keep tenant-created ones)
    await queryRunner.query(`
      DELETE FROM modules WHERE owner_type = 'platform';
    `);
  }
}
