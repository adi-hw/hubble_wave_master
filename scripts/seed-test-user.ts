import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

async function seed() {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USER || 'admin',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_NAME || 'eam_global',
    synchronize: false,
  });

  try {
    await dataSource.initialize();
    console.log('✅ Database connection established');

    const tenants = [
      { slug: 'test', name: 'Test Company' },
      { slug: 'acme', name: 'ACME Corp' }
    ];

    for (const t of tenants) {
      console.log(`\nProcessing tenant: ${t.slug}...`);
      
      // 1. Get or Create Tenant
      let tenantId = uuidv4();
      await dataSource.query(
        `INSERT INTO tenants (id, name, slug, status, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, NOW(), NOW())
         ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
        [tenantId, t.name, t.slug, 'ACTIVE']
      );
      
      const tenantRes = await dataSource.query(`SELECT id FROM tenants WHERE slug = $1`, [t.slug]);
      tenantId = tenantRes[0].id;
      console.log(`✅ Tenant ID: ${tenantId}`);

      // 2. Get or Create Admin Role
      // Check if role exists first since there might not be a unique constraint
      const roleRes = await dataSource.query(
        `SELECT id FROM roles WHERE "tenantId" = $1 AND name = $2`,
        [tenantId, 'admin']
      );
      
      let roleId;
      if (roleRes.length > 0) {
        roleId = roleRes[0].id;
        console.log(`✅ Role 'admin' already exists: ${roleId}`);
      } else {
        roleId = uuidv4();
        await dataSource.query(
          `INSERT INTO roles (id, name, description, "tenantId", permissions, "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
          [roleId, 'admin', 'Administrator role', tenantId, '']
        );
        console.log(`✅ Created role 'admin': ${roleId}`);
      }

      // 3. Get or Create Admin User
      const userRes = await dataSource.query(
        `SELECT id FROM user_accounts WHERE "tenantId" = $1 AND username = $2`,
        [tenantId, 'admin']
      );

      let userId;
      if (userRes.length > 0) {
        userId = userRes[0].id;
        console.log(`✅ User 'admin' already exists: ${userId}`);
      } else {
        userId = uuidv4();
        const passwordHash = await bcrypt.hash('Admin123!', 10);
        await dataSource.query(
          `INSERT INTO user_accounts (id, username, email, "displayName", "authSource", "passwordHash", "tenantId", status, "emailVerified", "failedLoginCount", "previousPasswords", "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())`,
          [userId, 'admin', `admin@${t.slug}.com`, 'Admin User', 'LOCAL', passwordHash, tenantId, 'ACTIVE', true, 0, '']
        );
        console.log(`✅ Created user 'admin': ${userId}`);
      }

      // 4. Assign Role
      const assignRes = await dataSource.query(
        `SELECT id FROM user_role_assignments WHERE "userId" = $1 AND "roleId" = $2`,
        [userId, roleId]
      );

      if (assignRes.length === 0) {
        await dataSource.query(
          `INSERT INTO user_role_assignments (id, "userId", "roleId", "tenantId")
           VALUES ($1, $2, $3, $4)`,
          [uuidv4(), userId, roleId, tenantId]
        );
        console.log(`✅ Assigned admin role to user`);
      } else {
        console.log(`✅ Role already assigned`);
      }
    }

    console.log('\n🎉 Seed completed successfully!');
    console.log('You can now login with:');
    console.log('Tenant: acme (or test)');
    console.log('Username: admin');
    console.log('Password: Admin123!');

    await dataSource.destroy();
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
}

seed();
