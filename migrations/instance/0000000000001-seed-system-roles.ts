import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Seed the five platform system roles with their canonical UUIDs, the
 * platform-permissions registry, and admin role-permission grants.
 *
 * Roles seeded (fixed UUIDs — FK references in downstream migrations are stable):
 *   admin      — full platform access (canon §28.6)
 *   auditor    — read access to audit and compliance surfaces
 *   manager    — operational management within scope
 *   technician — field technician access to work orders and assets
 *   viewer     — read-only dashboard and report access (default role)
 *
 * Permissions are seeded into identity.platform_permissions using the
 * structured schema in the baseline: (code, plane, domain, resource, action,
 * dangerous, description). Every permission is granted to the admin role via
 * identity.role_permissions (role_id, permission_code) composite PK.
 *
 * Idempotent: ON CONFLICT (code) DO NOTHING for roles; ON CONFLICT (code) DO
 * NOTHING for platform_permissions; ON CONFLICT (role_id, permission_code) DO
 * NOTHING for role_permissions.
 *
 * down() throws — roles are foundational structural data; removing them would
 * cascade-delete access rules, user assignments, and nav profiles.
 */
export class SeedSystemRoles0000000000001 implements MigrationInterface {
  // Timestamp sentinel 1000000000001 sorts after the baseline (1000000000000)
  // and before subsequent seeds, so TypeORM applies these in the correct order.
  name = 'SeedSystemRoles1000000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // -------------------------------------------------------------------------
    // Roles — canonical UUIDs match the live instance database so FK references
    // in all downstream migrations (admin policies, nav profiles) are stable.
    // -------------------------------------------------------------------------
    await queryRunner.query(`
      INSERT INTO identity.roles
        (id, code, name, description, is_system, is_active, is_default,
         scope, hierarchy_level, weight, metadata)
      VALUES
        ('936009c6-677a-4740-a202-ea00f3fa93c6', 'admin',      'Administrator',      'Full system access with all permissions',                        true,  true, false, 'global', 0, 0, '{}'),
        ('1c4f3568-56b2-42c5-8c97-2f1fee643ac8', 'auditor',    'Compliance Auditor', 'Read access to audit logs and compliance reports',               true,  true, false, 'global', 0, 0, '{}'),
        ('c685745e-10c9-4857-94f7-e83d42fd8379', 'manager',    'Manager',            'Can manage users, assets, and process flows within their scope', true,  true, false, 'global', 0, 0, '{}'),
        ('daf86eeb-e58e-4cf5-b5ad-3cd890c57729', 'technician', 'Technician',         'Field technician with access to work orders and assets',         true,  true, false, 'global', 0, 0, '{}'),
        ('3667289d-3327-4cfa-90cb-795d58a010f8', 'viewer',     'Viewer',             'Read-only access to dashboards and reports',                     true,  true, true,  'global', 0, 0, '{}')
      ON CONFLICT (code) DO NOTHING;
    `);

    // -------------------------------------------------------------------------
    // Platform permissions — seeds the identity.platform_permissions registry
    // using the baseline schema (code PK, plane, domain, resource, action,
    // dangerous, description). admin role gets every permission via
    // identity.role_permissions (role_id, permission_code composite key).
    // -------------------------------------------------------------------------
    await queryRunner.query(`
      INSERT INTO identity.platform_permissions
        (code, plane, domain, resource, action, dangerous, description)
      VALUES
        -- admin domain
        ('admin.audit',                            'instance',       'admin',         'audit_log',          'read',      false, 'Access audit trail'),
        ('admin.backup',                           'instance',       'admin',         'backup',             'execute',   true,  'Create and restore backups'),
        ('admin.integrations',                     'instance',       'admin',         'integration',        'manage',    false, 'Configure external integrations'),
        ('admin.policies.view',                    'instance',       'admin',         'access_policy',      'read',      false, 'Inspect row-level and field-level access rules'),
        ('admin.settings',                         'instance',       'admin',         'settings',           'write',     true,  'Modify system configuration'),
        ('notifications.send.direct',              'instance',       'admin',         'notification',       'send',      true,  'Send notifications directly to any recipient via the admin API (workflows do not need this)'),
        ('system.admin',                           'instance',       'admin',         'system',             'admin',     true,  'Platform superuser permission'),
        -- api domain
        ('api.access',                             'instance',       'api',           'explorer',           'read',      false, 'Access API Explorer'),
        -- assets domain
        ('assets.create',                          'instance',       'assets',        'asset',              'create',    false, 'Create new asset records'),
        ('assets.delete',                          'instance',       'assets',        'asset',              'delete',    true,  'Remove asset records'),
        ('assets.export',                          'instance',       'assets',        'asset',              'export',    false, 'Export asset data to files'),
        ('assets.import',                          'instance',       'assets',        'asset',              'import',    false, 'Bulk import assets from files'),
        ('assets.update',                          'instance',       'assets',        'asset',              'update',    false, 'Modify existing asset records'),
        ('assets.view',                            'instance',       'assets',        'asset',              'read',      false, 'View asset records and details'),
        -- ava domain
        ('ava.admin',                              'instance',       'ava',           'ava',                'admin',     true,  'Manage AVA prompts, governance, and execution policies'),
        -- collections domain
        ('collection.admin',                       'instance',       'collections',   'collection',         'admin',     true,  'Operation-agnostic collection access gate'),
        ('collection.create',                      'instance',       'collections',   'record',             'create',    false, 'Create records in collections'),
        ('collection.delete',                      'instance',       'collections',   'record',             'delete',    true,  'Delete records in collections'),
        ('collection.read',                        'instance',       'collections',   'record',             'read',      false, 'Read collection records and metadata'),
        ('collection.update',                      'instance',       'collections',   'record',             'update',    false, 'Update records in collections'),
        ('collections.create',                     'instance',       'collections',   'collection',         'create',    false, 'Create new collections/tables'),
        ('collections.delete',                     'instance',       'collections',   'collection',         'delete',    true,  'Remove collections'),
        ('collections.update',                     'instance',       'collections',   'collection',         'update',    false, 'Modify collection schema'),
        ('collections.view',                       'instance',       'collections',   'collection',         'read',      false, 'View collection definitions'),
        ('property.create',                        'instance',       'collections',   'property',           'create',    false, 'Create property definitions on a collection'),
        ('property.delete',                        'instance',       'collections',   'property',           'delete',    true,  'Delete property definitions on a collection'),
        ('property.read',                          'instance',       'collections',   'property',           'read',      false, 'Read property definitions on a collection'),
        ('property.update',                        'instance',       'collections',   'property',           'update',    false, 'Update property definitions on a collection'),
        -- delegations domain
        ('delegations.admin',                      'instance',       'delegations',   'delegation',         'admin',     true,  'View and manage delegations across all users'),
        ('delegations.approve',                    'instance',       'delegations',   'delegation',         'approve',   false, 'Approve pending authority delegations on behalf of others'),
        -- groups domain
        ('groups.assign-roles',                    'instance',       'groups',        'group',              'assign_role', false, 'Assign roles to groups'),
        ('groups.create',                          'instance',       'groups',        'group',              'create',    false, 'Create new groups'),
        ('groups.delete',                          'instance',       'groups',        'group',              'delete',    false, 'Remove groups'),
        ('groups.manage-members',                  'instance',       'groups',        'group',              'manage_members', false, 'Add/remove group members'),
        ('groups.update',                          'instance',       'groups',        'group',              'update',    false, 'Modify group settings'),
        ('groups.view',                            'instance',       'groups',        'group',              'read',      false, 'View groups and teams'),
        -- metadata domain
        ('metadata.change-packages.edit',          'instance',       'metadata',      'change_package',     'write',     false, 'Author and apply App Studio Change Packages'),
        ('metadata.choices.edit',                  'instance',       'metadata',      'choice_list',        'write',     false, 'Edit choice list definitions'),
        ('metadata.collections.edit',              'instance',       'metadata',      'collection',         'write',     false, 'Edit collection schema in App Studio'),
        ('metadata.collections.spreadsheet.write', 'instance',       'metadata',      'collection',         'spreadsheet_write', true, 'Enter App Studio spreadsheet edit mode'),
        ('metadata.flows.edit',                    'instance',       'metadata',      'flow',               'write',     false, 'Edit Process Flow and flow-adjacent metadata'),
        ('metadata.forms.edit',                    'instance',       'metadata',      'form',               'write',     false, 'Edit Record Form layouts in App Studio'),
        ('metadata.policies.edit',                 'instance',       'metadata',      'policy',             'write',     false, 'Edit access rules, Display Rules, and Automation Rules'),
        ('metadata.properties.edit',               'instance',       'metadata',      'property',           'write',     false, 'Edit property definitions in App Studio'),
        ('metadata.workspaces.edit',               'instance',       'metadata',      'workspace',          'write',     false, 'Edit App Studio Workspace definitions'),
        -- navigation domain
        ('navigation.manage',                      'instance',       'navigation',    'nav',                'write',     false, 'Configure navigation menus'),
        ('navigation.view',                        'instance',       'navigation',    'nav',                'read',      false, 'View navigation configuration'),
        -- process-flows domain
        ('process-flows.activate',                 'instance',       'process_flows', 'process_flow',       'activate',  false, 'Toggle isActive on a published process flow (route runtime traffic to it)'),
        ('process-flows.create',                   'instance',       'process_flows', 'process_flow',       'create',    false, 'Design new process flows'),
        ('process-flows.delete',                   'instance',       'process_flows', 'process_flow',       'delete',    false, 'Remove process flows'),
        ('process-flows.execute',                  'instance',       'process_flows', 'process_flow',       'execute',   false, 'Manually trigger process flows'),
        ('process-flows.publish',                  'instance',       'process_flows', 'process_flow',       'publish',   false, 'Promote a draft process flow revision to published (ADR-5 lifecycle)'),
        ('process-flows.update',                   'instance',       'process_flows', 'process_flow',       'update',    false, 'Modify process flow definitions'),
        ('process-flows.view',                     'instance',       'process_flows', 'process_flow',       'read',      false, 'View process flow definitions'),
        ('workflow.run-as-system',                 'instance',       'process_flows', 'process_flow',       'run_as_system', true, 'Execute Process Flows under the system actor identity'),
        -- reports domain
        ('reports.create',                         'instance',       'reports',       'report',             'create',    false, 'Create custom reports'),
        ('reports.export',                         'instance',       'reports',       'report',             'export',    false, 'Export reports to PDF/Excel'),
        ('reports.schedule',                       'instance',       'reports',       'report',             'schedule',  false, 'Set up automated report delivery'),
        ('reports.view',                           'instance',       'reports',       'report',             'read',      false, 'Access standard reports'),
        -- roles domain
        ('roles.create',                           'instance',       'roles',         'role',               'create',    false, 'Create new roles'),
        ('roles.delete',                           'instance',       'roles',         'role',               'delete',    true,  'Remove roles'),
        ('roles.update',                           'instance',       'roles',         'role',               'update',    false, 'Modify role permissions'),
        ('roles.view',                             'instance',       'roles',         'role',               'read',      false, 'View roles and permissions'),
        -- scripts domain
        ('scripts.create',                         'instance',       'scripts',       'script',             'create',    false, 'Create new scripts'),
        ('scripts.delete',                         'instance',       'scripts',       'script',             'delete',    false, 'Remove scripts'),
        ('scripts.execute',                        'instance',       'scripts',       'script',             'execute',   false, 'Run scripts'),
        ('scripts.update',                         'instance',       'scripts',       'script',             'update',    false, 'Modify scripts'),
        ('scripts.view',                           'instance',       'scripts',       'script',             'read',      false, 'View script definitions'),
        -- users domain
        ('users.assign-roles',                     'instance',       'users',         'user',               'assign_role', false, 'Assign roles to users'),
        ('users.create',                           'instance',       'users',         'user',               'create',    false, 'Create new user accounts'),
        ('users.delete',                           'instance',       'users',         'user',               'delete',    true,  'Deactivate user accounts'),
        ('users.impersonate',                      'instance',       'users',         'user',               'impersonate', true, 'Login as another user (audit logged)'),
        ('users.update',                           'instance',       'users',         'user',               'update',    false, 'Modify user accounts'),
        ('users.view',                             'instance',       'users',         'user',               'read',      false, 'View user profiles'),
        -- views domain
        ('views.create',                           'instance',       'views',         'view',               'create',    false, 'Create new views'),
        ('views.delete',                           'instance',       'views',         'view',               'delete',    false, 'Remove views'),
        ('views.update',                           'instance',       'views',         'view',               'update',    false, 'Modify views'),
        ('views.view',                             'instance',       'views',         'view',               'read',      false, 'View saved views'),
        -- work-orders domain
        ('work-orders.assign',                     'instance',       'work_orders',   'work_order',         'assign',    false, 'Assign work orders to technicians'),
        ('work-orders.close',                      'instance',       'work_orders',   'work_order',         'close',     false, 'Mark work orders as complete'),
        ('work-orders.create',                     'instance',       'work_orders',   'work_order',         'create',    false, 'Create new work orders'),
        ('work-orders.delete',                     'instance',       'work_orders',   'work_order',         'delete',    false, 'Remove work orders'),
        ('work-orders.update',                     'instance',       'work_orders',   'work_order',         'update',    false, 'Modify work orders'),
        ('work-orders.view',                       'instance',       'work_orders',   'work_order',         'read',      false, 'View work order records')
      ON CONFLICT (code) DO NOTHING;
    `);

    // -------------------------------------------------------------------------
    // Role-permissions — grant every permission to the admin role.
    // The composite PK (role_id, permission_code) makes this idempotent.
    // -------------------------------------------------------------------------
    await queryRunner.query(`
      INSERT INTO identity.role_permissions (role_id, permission_code)
      SELECT
        '936009c6-677a-4740-a202-ea00f3fa93c6',
        p.code
      FROM identity.platform_permissions p
      ON CONFLICT (role_id, permission_code) DO NOTHING;
    `);
  }

  public async down(): Promise<void> {
    throw new Error('Seed migration is forward-only');
  }
}
