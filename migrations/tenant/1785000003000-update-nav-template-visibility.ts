import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Update Navigation Template Visibility
 *
 * Removes role restrictions from Admin and Studio sections
 * to make them visible to all authenticated users during development.
 * Role-based restrictions can be re-enabled later via patches.
 */
export class UpdateNavTemplateVisibility1785000003000 implements MigrationInterface {
  name = 'UpdateNavTemplateVisibility1785000003000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Update the default_eam template to remove visibility restrictions
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
          "label": "Recent",
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
            },
            {
              "key": "admin.navigation",
              "label": "Navigation Profiles",
              "icon": "Navigation",
              "type": "module",
              "moduleKey": "admin.navigation.list",
              "order": 30
            },
            {
              "key": "admin.table_acl",
              "label": "Table ACLs",
              "icon": "Lock",
              "type": "module",
              "moduleKey": "admin.acl.table",
              "order": 40
            },
            {
              "key": "admin.workflows",
              "label": "Workflows",
              "icon": "GitBranch",
              "type": "module",
              "moduleKey": "admin.workflows.list",
              "order": 50
            },
            {
              "key": "admin.business_rules",
              "label": "Business Rules",
              "icon": "FileCode",
              "type": "module",
              "moduleKey": "admin.business_rules.list",
              "order": 60
            },
            {
              "key": "admin.notification_channels",
              "label": "Notification Channels",
              "icon": "Bell",
              "type": "module",
              "moduleKey": "admin.notifications.channels",
              "order": 70
            },
            {
              "key": "admin.notification_templates",
              "label": "Notification Templates",
              "icon": "FileText",
              "type": "module",
              "moduleKey": "admin.notifications.templates",
              "order": 80
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
      version = '1.1.0',
      updated_at = NOW()
      WHERE key = 'default_eam';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert to previous version with visibility restrictions
    // (This would restore the original visibility rules - not implemented for brevity)
  }
}
