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
 * Post-migration bootstrap: ensure the admin user exists with the requested
 * credentials and is bound to the admin role.
 *
 * The admin role is created by migration 1000000000001-seed-system-roles.ts
 * with a fixed UUID (936009c6-677a-4740-a202-ea00f3fa93c6). Admin authority
 * comes from CollectionAccessRule + wildcard PropertyAccessRule rows seeded
 * by migration 1000000000003-seed-admin-policies.ts.
 *
 * Permission registry (identity.platform_permissions + identity.role_permissions)
 * is NOT populated by this script. Per W2 spec §2.3, the PERMISSION_REGISTRY
 * TypeScript constant is the single source of truth for those tables,
 * materialized by scripts/seed-permission-registry-sync.ts in Stream 2 PR3.
 *
 * Env vars required: DB_PASSWORD, ADMIN_EMAIL, DEFAULT_ADMIN_PASSWORD,
 * ADMIN_FIRST_NAME, ADMIN_LAST_NAME. ADMIN_DISPLAY_NAME optional.
 */
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

    // Resolve the admin role seeded by migration 1000000000001.
    const roleRes = await dataSource.query(
      `SELECT id FROM identity.roles WHERE code = $1`,
      ['admin'],
    );
    if (roleRes.length === 0) {
      throw new Error(
        'Admin role not found. Run migration 1000000000001-seed-system-roles before invoking this script.',
      );
    }
    const roleId: string = roleRes[0].id;
    console.log(`✅ Admin role resolved: ${roleId}`);

    // Upsert the admin user from env vars.
    const email = requireEnv('ADMIN_EMAIL');
    const password = requireEnv('DEFAULT_ADMIN_PASSWORD');
    const firstName = requireEnv('ADMIN_FIRST_NAME');
    const lastName = requireEnv('ADMIN_LAST_NAME');
    const displayName = process.env.ADMIN_DISPLAY_NAME || `${firstName} ${lastName}`;
    console.log(`\n👤 Creating user: ${email}...`);

    let userId: string;
    const userRes = await dataSource.query(
      `SELECT id FROM public.users WHERE email = $1`,
      [email],
    );
    const passwordHash = await argon2.hash(password);

    if (userRes.length > 0) {
      userId = userRes[0].id;
      await dataSource.query(
        `UPDATE public.users
         SET password_hash = $1,
             status = 'active',
             display_name = $2,
             first_name = $3,
             last_name = $4,
             email_verified = true,
             is_admin = true
         WHERE id = $5`,
        [passwordHash, displayName, firstName, lastName, userId],
      );
      console.log(`✅ Updated existing user ${email}`);
    } else {
      userId = uuidv4();
      await dataSource.query(
        `INSERT INTO public.users (
           id, email, password_hash, status,
           display_name, first_name, last_name,
           email_verified, is_admin, failed_login_attempts, created_at, updated_at
         )
         VALUES ($1, $2, $3, 'active', $4, $5, $6, true, true, 0, NOW(), NOW())`,
        [userId, email, passwordHash, displayName, firstName, lastName],
      );
      console.log(`✅ Created user ${email}`);
    }

    // Bind admin role to the user.
    await dataSource.query(
      `INSERT INTO identity.user_roles (user_id, role_id, created_at)
       VALUES ($1, $2, NOW()) ON CONFLICT DO NOTHING`,
      [userId, roleId],
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
