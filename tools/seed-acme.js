const { DataSource } = require('typeorm');
const argon2 = require('argon2');
const { Client } = require('pg');
require('dotenv').config();

async function seedAcmeTenant() {
  console.log('🌱 Seeding acme tenant...\n');

  // 1. Add tenant to platform DB using raw SQL
  const platformClient = new Client({
    host: process.env.PLATFORM_DB_HOST || 'localhost',
    port: parseInt(process.env.PLATFORM_DB_PORT || '5432'),
    user: process.env.PLATFORM_DB_USER || 'admin',
    password: process.env.PLATFORM_DB_PASSWORD || 'password',
    database: 'eam_global',
  });

  await platformClient.connect();
  console.log('✓ Connected to platform DB');

  // Check if tenant exists
  const tenantCheck = await platformClient.query(
    `SELECT id FROM tenants WHERE slug = $1`,
    ['acme']
  );

  let tenantId;
  if (tenantCheck.rows.length === 0) {
    const result = await platformClient.query(
      `INSERT INTO tenants (slug, name, db_host, db_port, db_name, db_user, db_password_enc, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
       RETURNING id`,
      ['acme', 'Acme Corporation', 'localhost', 5432, 'eam_tenant_acme', 'admin', 'password', 'ACTIVE']
    );
    tenantId = result.rows[0].id;
    console.log('✓ Created acme tenant in platform DB');
  } else {
    tenantId = tenantCheck.rows[0].id;
    console.log('✓ Acme tenant already exists');
  }

  await platformClient.end();

  // 2. Create admin user in tenant DB using raw SQL
  const tenantClient = new Client({
    host: process.env.TENANT_DB_HOST || 'localhost',
    port: parseInt(process.env.TENANT_DB_PORT || '5432'),
    user: process.env.TENANT_DB_USER || 'admin',
    password: process.env.TENANT_DB_PASSWORD || 'password',
    database: 'eam_tenant_acme',
  });

  await tenantClient.connect();
  console.log('✓ Connected to tenant DB\n');

  // Create admin role
  const roleCheck = await tenantClient.query(
    `SELECT id FROM roles WHERE name = $1`,
    ['admin']
  );

  let roleId;
  if (roleCheck.rows.length === 0) {
    const result = await tenantClient.query(
      `INSERT INTO roles (name, description, "createdAt", "updatedAt")
       VALUES ($1, $2, NOW(), NOW())
       RETURNING id`,
      ['admin', 'System Administrator']
    );
    roleId = result.rows[0].id;
    console.log('✓ Created admin role');
  } else {
    roleId = roleCheck.rows[0].id;
    console.log('✓ Admin role already exists');
  }

  // Create admin user
  const userCheck = await tenantClient.query(
    `SELECT id FROM user_accounts WHERE username = $1`,
    ['admin']
  );

  let userId;
  if (userCheck.rows.length === 0) {
    const passwordHash = await argon2.hash('password');
    const result = await tenantClient.query(
      `INSERT INTO user_accounts (username, email, "displayName", "authSource", "passwordHash", status, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
       RETURNING id`,
      ['admin', 'admin@acme.com', 'System Administrator', 'LOCAL', passwordHash, 'ACTIVE']
    );
    userId = result.rows[0].id;
    console.log('✓ Created admin user (username: admin, password: password)');
  } else {
    userId = userCheck.rows[0].id;
    console.log('✓ Admin user already exists');
  }

  // Assign admin role to admin user
  const assignmentCheck = await tenantClient.query(
    `SELECT id FROM user_role_assignments WHERE "userId" = $1 AND "roleId" = $2`,
    [userId, roleId]
  );

  if (assignmentCheck.rows.length === 0) {
    await tenantClient.query(
      `INSERT INTO user_role_assignments ("userId", "roleId", "createdAt")
       VALUES ($1, $2, NOW())`,
      [userId, roleId]
    );
    console.log('✓ Assigned admin role to admin user');
  } else {
    console.log('✓ Role assignment already exists');
  }

  await tenantClient.end();

  console.log('\n✅ Seeding complete!');
  console.log('\n📝 Test Credentials:');
  console.log('   Tenant Slug: acme');
  console.log('   Username: admin');
  console.log('   Password: password');
  console.log('\n🚀 Next Steps:');
  console.log('   1. Start services: npm run dev:identity');
  console.log('   2. Test login at: http://localhost:4200/login');
}

seedAcmeTenant().catch((error) => {
  console.error('❌ Error during seeding:', error);
  process.exit(1);
});
