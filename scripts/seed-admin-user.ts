import { DataSource } from 'typeorm';
import * as argon2 from 'argon2';
import { v4 as uuidv4 } from 'uuid';

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
];

async function seed() {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.POSTGRES_USER || 'hubblewave',
    password: process.env.POSTGRES_PASSWORD || 'hubblewave',
    database: process.env.POSTGRES_DB || 'hubblewave',
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
    const email = 'adityasingampally@hubblewave.com';
    const password = 'password123';
    console.log(`\n👤 Creating user: ${email}...`);

    let userId: string;
    const userRes = await dataSource.query(`SELECT id FROM users WHERE email = $1`, [email]);

    const passwordHash = await argon2.hash(password);

    if (userRes.length > 0) {
      userId = userRes[0].id;
      await dataSource.query(
        `UPDATE users SET password_hash = $1, status = 'active' WHERE id = $2`,
        [passwordHash, userId]
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
         VALUES ($1, $2, $3, 'active', 'Aditya Singampally', 'Aditya', 'Singampally', true, true, 0, NOW(), NOW())`,
        [userId, email, passwordHash]
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
