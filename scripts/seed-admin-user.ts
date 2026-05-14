import 'dotenv/config';
import { DataSource } from 'typeorm';
import * as argon2 from 'argon2';
import { v4 as uuidv4 } from 'uuid';

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`${key} must be set before seeding admin`);
  }
  return value;
}

/**
 * Default permissions to seed
 */
const DEFAULT_PERMISSIONS = [
  // Users
  { code: 'users.view', name: 'View Users', description: 'View user profiles', category: 'users' },
  { code: 'users.create', name: 'Create Users', description: 'Create new user accounts', category: 'users' },
  { code: 'users.update', name: 'Update Users', description: 'Modify user accounts', category: 'users' },
  { code: 'users.delete', name: 'Delete Users', description: 'Deactivate user accounts', category: 'users' },
  { code: 'users.assign-roles', name: 'Assign Roles', description: 'Assign roles to users', category: 'users' },
  { code: 'users.impersonate', name: 'Impersonate Users', description: 'Login as another user', category: 'users' },

  // Groups
  { code: 'groups.view', name: 'View Groups', description: 'View groups and teams', category: 'groups' },
  { code: 'groups.create', name: 'Create Groups', description: 'Create new groups', category: 'groups' },
  { code: 'groups.update', name: 'Update Groups', description: 'Modify group settings', category: 'groups' },
  { code: 'groups.delete', name: 'Delete Groups', description: 'Remove groups', category: 'groups' },
  { code: 'groups.manage-members', name: 'Manage Members', description: 'Add/remove group members', category: 'groups' },
  { code: 'groups.assign-roles', name: 'Assign Roles to Groups', description: 'Assign roles to groups', category: 'groups' },

  // Roles
  { code: 'roles.view', name: 'View Roles', description: 'View roles and permissions', category: 'roles' },
  { code: 'roles.create', name: 'Create Roles', description: 'Create new roles', category: 'roles' },
  { code: 'roles.update', name: 'Update Roles', description: 'Modify role permissions', category: 'roles' },
  { code: 'roles.delete', name: 'Delete Roles', description: 'Remove roles', category: 'roles' },

  // Administration
  { code: 'admin.settings', name: 'System Settings', description: 'Modify system configuration', category: 'admin' },
  { code: 'admin.audit', name: 'View Audit Logs', description: 'Access audit trail', category: 'admin' },
  { code: 'admin.integrations', name: 'Manage Integrations', description: 'Configure external integrations', category: 'admin' },
  { code: 'admin.backup', name: 'Backup/Restore', description: 'Create and restore backups', category: 'admin' },

  // App Studio / metadata permissions. Keep this script in sync with
  // PermissionSeederService so local dev bootstrap does not depend on
  // remembering a separate permission migration before logging in.
  { code: 'system.admin', name: 'System Administrator', description: 'Platform superuser permission', category: 'admin' },
  { code: 'collection.admin', name: 'Collection Administrator', description: 'Operation-agnostic collection access gate', category: 'collections' },
  { code: 'collection.read', name: 'Read Collections', description: 'Read collection records and metadata', category: 'collections' },
  { code: 'collection.create', name: 'Create Collection Records', description: 'Create records in collections', category: 'collections' },
  { code: 'collection.update', name: 'Update Collection Records', description: 'Update records in collections', category: 'collections' },
  { code: 'collection.delete', name: 'Delete Collection Records', description: 'Delete records in collections', category: 'collections' },
  { code: 'property.read', name: 'Read Properties', description: 'Read property definitions on a collection', category: 'collections' },
  { code: 'property.create', name: 'Create Properties', description: 'Create property definitions on a collection', category: 'collections' },
  { code: 'property.update', name: 'Update Properties', description: 'Update property definitions on a collection', category: 'collections' },
  { code: 'property.delete', name: 'Delete Properties', description: 'Delete property definitions on a collection', category: 'collections' },
  { code: 'metadata.collections.edit', name: 'Edit Collections', description: 'Edit collection schema in App Studio', category: 'metadata' },
  { code: 'metadata.properties.edit', name: 'Edit Properties', description: 'Edit property definitions in App Studio', category: 'metadata' },
  { code: 'metadata.forms.edit', name: 'Edit Forms', description: 'Edit Record Form layouts in App Studio', category: 'metadata' },
  { code: 'metadata.policies.edit', name: 'Edit Policies and Rules', description: 'Edit access rules, Display Rules, and Automation Rules', category: 'metadata' },
  { code: 'metadata.choices.edit', name: 'Edit Choice Lists', description: 'Edit choice list definitions', category: 'metadata' },
  { code: 'metadata.flows.edit', name: 'Edit Flows', description: 'Edit Process Flow and flow-adjacent metadata', category: 'metadata' },
  { code: 'metadata.collections.spreadsheet.write', name: 'Write Spreadsheet', description: 'Enter App Studio spreadsheet edit mode', category: 'metadata' },
  { code: 'metadata.workspaces.edit', name: 'Edit Workspaces', description: 'Edit App Studio Workspace definitions', category: 'metadata' },
  { code: 'metadata.change-packages.edit', name: 'Edit Change Packages', description: 'Author and apply App Studio Change Packages', category: 'metadata' },
  { code: 'ava.admin', name: 'AVA Administrator', description: 'Manage AVA prompts, governance, and execution policies', category: 'ava' },
  { code: 'workflow.run-as-system', name: 'Run Workflow As System', description: 'Execute Process Flows under the system actor identity', category: 'process-flows' },
];

async function seed() {
  const dbPassword = requireEnv('DB_PASSWORD');
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USER || 'hubblewave',
    password: dbPassword,
    database: process.env.DB_NAME || 'hubblewave',
    synchronize: false,
  });

  try {
    await dataSource.initialize();
    console.log('✅ Database connection established');

    // 1. Seed permissions
    console.log('\n📋 Seeding permissions...');
    for (const perm of DEFAULT_PERMISSIONS) {
      await dataSource.query(
        `INSERT INTO permissions (id, code, name, description, category, is_system, is_dangerous, display_order, created_at)
         VALUES ($1, $2, $3, $4, $5, true, false, 0, NOW())
         ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name`,
        [uuidv4(), perm.code, perm.name, perm.description, perm.category]
      );
    }

    // 2. Create admin role
    const roleCode = 'admin';
    let roleId: string;
    const roleRes = await dataSource.query(`SELECT id FROM roles WHERE code = $1`, [roleCode]);

    if (roleRes.length > 0) {
      roleId = roleRes[0].id;
      console.log(`✅ Role ${roleCode} found: ${roleId}`);
    } else {
      roleId = uuidv4();
      await dataSource.query(
        `INSERT INTO roles (id, code, name, description, is_system, is_active, created_at)
         VALUES ($1, $2, 'Administrator', 'Full Access', true, true, NOW())`,
        [roleId, roleCode]
      );
      console.log(`✅ Created role ${roleCode}: ${roleId}`);
    }

    // Assign all permissions to admin
    const allPerms = await dataSource.query(`SELECT id FROM permissions`);
    for (const perm of allPerms) {
      await dataSource.query(
        `INSERT INTO role_permissions (role_id, permission_id, created_at)
         VALUES ($1, $2, NOW()) ON CONFLICT DO NOTHING`,
        [roleId, perm.id]
      );
    }

    // 3. Create requested user
    const email = requireEnv('ADMIN_EMAIL');
    const password = requireEnv('DEFAULT_ADMIN_PASSWORD');
    const firstName = requireEnv('ADMIN_FIRST_NAME');
    const lastName = requireEnv('ADMIN_LAST_NAME');
    const displayName = process.env.ADMIN_DISPLAY_NAME || `${firstName} ${lastName}`;
    console.log(`\n👤 Creating user: ${email}...`);

    let userId: string;
    const userRes = await dataSource.query(`SELECT id FROM users WHERE email = $1`, [email]);

    const passwordHash = await argon2.hash(password);

    if (userRes.length > 0) {
      userId = userRes[0].id;
      await dataSource.query(
        `UPDATE users
         SET password_hash = $1,
             status = 'active',
             display_name = $2,
             first_name = $3,
             last_name = $4,
             email_verified = true,
             is_admin = true
         WHERE id = $5`,
        [passwordHash, displayName, firstName, lastName, userId]
      );
      console.log(`✅ Updated existing user ${email}`);
    } else {
      userId = uuidv4();
      await dataSource.query(
        `INSERT INTO users (
           id, email, password_hash, status, 
           display_name, first_name, last_name,
           email_verified, is_admin, failed_login_attempts, created_at, updated_at
         )
         VALUES ($1, $2, $3, 'active', $4, $5, $6, true, true, 0, NOW(), NOW())`,
        [userId, email, passwordHash, displayName, firstName, lastName]
      );
      console.log(`✅ Created user ${email}`);
    }

    // 4. Assign admin role
    await dataSource.query(
      `INSERT INTO user_roles (user_id, role_id, created_at)
       VALUES ($1, $2, NOW()) ON CONFLICT DO NOTHING`,
      [userId, roleId]
    );
    console.log(`✅ Assigned admin role`);

    console.log('\n🎉 Seed completed successfully!');
    await dataSource.destroy();
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
}

seed();
