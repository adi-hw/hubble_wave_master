import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Seed Admin Role and Permissions
 *
 * Creates the admin role and all system permissions BEFORE the admin user migration.
 * This ensures the admin user can be properly linked to the admin role.
 */
export class SeedAdminRole1817999999999 implements MigrationInterface {
  name = 'SeedAdminRole1817999999999';

  private readonly permissions = [
    // Assets
    { slug: 'assets.view', name: 'View Assets', description: 'View asset records and details', category: 'assets', isDangerous: false },
    { slug: 'assets.create', name: 'Create Assets', description: 'Create new asset records', category: 'assets', isDangerous: false },
    { slug: 'assets.update', name: 'Update Assets', description: 'Modify existing asset records', category: 'assets', isDangerous: false },
    { slug: 'assets.delete', name: 'Delete Assets', description: 'Remove asset records', category: 'assets', isDangerous: true },
    { slug: 'assets.import', name: 'Import Assets', description: 'Bulk import assets from files', category: 'assets', isDangerous: false },
    { slug: 'assets.export', name: 'Export Assets', description: 'Export asset data to files', category: 'assets', isDangerous: false },

    // Work Orders
    { slug: 'work-orders.view', name: 'View Work Orders', description: 'View work order records', category: 'work-orders', isDangerous: false },
    { slug: 'work-orders.create', name: 'Create Work Orders', description: 'Create new work orders', category: 'work-orders', isDangerous: false },
    { slug: 'work-orders.update', name: 'Update Work Orders', description: 'Modify work orders', category: 'work-orders', isDangerous: false },
    { slug: 'work-orders.delete', name: 'Delete Work Orders', description: 'Remove work orders', category: 'work-orders', isDangerous: false },
    { slug: 'work-orders.assign', name: 'Assign Work Orders', description: 'Assign work orders to technicians', category: 'work-orders', isDangerous: false },
    { slug: 'work-orders.close', name: 'Close Work Orders', description: 'Mark work orders as complete', category: 'work-orders', isDangerous: false },

    // Users
    { slug: 'users.view', name: 'View Users', description: 'View user profiles', category: 'users', isDangerous: false },
    { slug: 'users.create', name: 'Create Users', description: 'Create new user accounts', category: 'users', isDangerous: false },
    { slug: 'users.update', name: 'Update Users', description: 'Modify user accounts', category: 'users', isDangerous: false },
    { slug: 'users.delete', name: 'Delete Users', description: 'Deactivate user accounts', category: 'users', isDangerous: true },
    { slug: 'users.assign-roles', name: 'Assign Roles', description: 'Assign roles to users', category: 'users', isDangerous: false },
    { slug: 'users.impersonate', name: 'Impersonate Users', description: 'Login as another user (audit logged)', category: 'users', isDangerous: true },

    // Groups
    { slug: 'groups.view', name: 'View Groups', description: 'View groups and teams', category: 'groups', isDangerous: false },
    { slug: 'groups.create', name: 'Create Groups', description: 'Create new groups', category: 'groups', isDangerous: false },
    { slug: 'groups.update', name: 'Update Groups', description: 'Modify group settings', category: 'groups', isDangerous: false },
    { slug: 'groups.delete', name: 'Delete Groups', description: 'Remove groups', category: 'groups', isDangerous: false },
    { slug: 'groups.manage-members', name: 'Manage Members', description: 'Add/remove group members', category: 'groups', isDangerous: false },
    { slug: 'groups.assign-roles', name: 'Assign Roles to Groups', description: 'Assign roles to groups', category: 'groups', isDangerous: false },

    // Roles
    { slug: 'roles.view', name: 'View Roles', description: 'View roles and permissions', category: 'roles', isDangerous: false },
    { slug: 'roles.create', name: 'Create Roles', description: 'Create new roles', category: 'roles', isDangerous: false },
    { slug: 'roles.update', name: 'Update Roles', description: 'Modify role permissions', category: 'roles', isDangerous: false },
    { slug: 'roles.delete', name: 'Delete Roles', description: 'Remove roles', category: 'roles', isDangerous: true },

    // Reports
    { slug: 'reports.view', name: 'View Reports', description: 'Access standard reports', category: 'reports', isDangerous: false },
    { slug: 'reports.create', name: 'Create Reports', description: 'Create custom reports', category: 'reports', isDangerous: false },
    { slug: 'reports.export', name: 'Export Reports', description: 'Export reports to PDF/Excel', category: 'reports', isDangerous: false },
    { slug: 'reports.schedule', name: 'Schedule Reports', description: 'Set up automated report delivery', category: 'reports', isDangerous: false },

    // Process Flows
    { slug: 'process-flows.view', name: 'View Process Flows', description: 'View process flow definitions', category: 'process-flows', isDangerous: false },
    { slug: 'process-flows.create', name: 'Create Process Flows', description: 'Design new process flows', category: 'process-flows', isDangerous: false },
    { slug: 'process-flows.update', name: 'Update Process Flows', description: 'Modify process flow definitions', category: 'process-flows', isDangerous: false },
    { slug: 'process-flows.delete', name: 'Delete Process Flows', description: 'Remove process flows', category: 'process-flows', isDangerous: false },
    { slug: 'process-flows.execute', name: 'Execute Process Flows', description: 'Manually trigger process flows', category: 'process-flows', isDangerous: false },

    // Collections (Schema)
    { slug: 'collections.view', name: 'View Collections', description: 'View collection definitions', category: 'collections', isDangerous: false },
    { slug: 'collections.create', name: 'Create Collections', description: 'Create new collections/tables', category: 'collections', isDangerous: false },
    { slug: 'collections.update', name: 'Update Collections', description: 'Modify collection schema', category: 'collections', isDangerous: false },
    { slug: 'collections.delete', name: 'Delete Collections', description: 'Remove collections', category: 'collections', isDangerous: true },

    // Scripts
    { slug: 'scripts.view', name: 'View Scripts', description: 'View script definitions', category: 'scripts', isDangerous: false },
    { slug: 'scripts.create', name: 'Create Scripts', description: 'Create new scripts', category: 'scripts', isDangerous: false },
    { slug: 'scripts.update', name: 'Update Scripts', description: 'Modify scripts', category: 'scripts', isDangerous: false },
    { slug: 'scripts.delete', name: 'Delete Scripts', description: 'Remove scripts', category: 'scripts', isDangerous: false },
    { slug: 'scripts.execute', name: 'Execute Scripts', description: 'Run scripts', category: 'scripts', isDangerous: false },

    // Administration
    { slug: 'admin.settings', name: 'System Settings', description: 'Modify system configuration', category: 'admin', isDangerous: true },
    { slug: 'admin.audit', name: 'View Audit Logs', description: 'Access audit trail', category: 'admin', isDangerous: false },
    { slug: 'admin.integrations', name: 'Manage Integrations', description: 'Configure external integrations', category: 'admin', isDangerous: false },
    { slug: 'admin.backup', name: 'Backup/Restore', description: 'Create and restore backups', category: 'admin', isDangerous: true },

    // Navigation
    { slug: 'navigation.view', name: 'View Navigation', description: 'View navigation configuration', category: 'navigation', isDangerous: false },
    { slug: 'navigation.manage', name: 'Manage Navigation', description: 'Configure navigation menus', category: 'navigation', isDangerous: false },

    // Views
    { slug: 'views.view', name: 'View Views', description: 'View saved views', category: 'views', isDangerous: false },
    { slug: 'views.create', name: 'Create Views', description: 'Create new views', category: 'views', isDangerous: false },
    { slug: 'views.update', name: 'Update Views', description: 'Modify views', category: 'views', isDangerous: false },
    { slug: 'views.delete', name: 'Delete Views', description: 'Remove views', category: 'views', isDangerous: false },

    // API
    { slug: 'api.access', name: 'API Access', description: 'Access API Explorer', category: 'api', isDangerous: false },
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if admin role already exists
    const existingRole = await queryRunner.query(
      `SELECT id FROM roles WHERE code = 'admin' LIMIT 1`
    );

    if (existingRole && existingRole.length > 0) {
      console.log('Admin role already exists, skipping seed');
      return;
    }

    // Create all permissions
    for (const perm of this.permissions) {
      await queryRunner.query(`
        INSERT INTO permissions (id, code, name, description, category, is_dangerous, is_system, created_at, updated_at)
        VALUES (
          uuid_generate_v4(),
          '${perm.slug}',
          '${perm.name}',
          '${perm.description}',
          '${perm.category}',
          ${perm.isDangerous},
          true,
          NOW(),
          NOW()
        )
        ON CONFLICT (code) DO NOTHING
      `);
    }

    // Create admin role
    const roleResult = await queryRunner.query(`
      INSERT INTO roles (id, code, name, description, color, is_system, is_active, is_default, created_at, updated_at)
      VALUES (
        uuid_generate_v4(),
        'admin',
        'Administrator',
        'Full system access with all permissions',
        '#ef4444',
        true,
        true,
        false,
        NOW(),
        NOW()
      )
      RETURNING id
    `);

    const adminRoleId = roleResult[0]?.id;
    if (!adminRoleId) {
      throw new Error('Failed to create admin role');
    }

    // Assign all permissions to admin role
    const allPermissions = await queryRunner.query(`SELECT id FROM permissions`);

    for (const perm of allPermissions) {
      await queryRunner.query(`
        INSERT INTO role_permissions (id, role_id, permission_id, created_at)
        VALUES (uuid_generate_v4(), '${adminRoleId}', '${perm.id}', NOW())
        ON CONFLICT DO NOTHING
      `);
    }

    console.log('Admin role created with all permissions');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove role permissions for admin
    await queryRunner.query(`
      DELETE FROM role_permissions
      WHERE role_id IN (SELECT id FROM roles WHERE code = 'admin')
    `);

    // Remove admin role
    await queryRunner.query(`DELETE FROM roles WHERE code = 'admin'`);

    // Remove seeded permissions
    const slugs = this.permissions.map(p => `'${p.slug}'`).join(',');
    await queryRunner.query(`DELETE FROM permissions WHERE code IN (${slugs})`);
  }
}
