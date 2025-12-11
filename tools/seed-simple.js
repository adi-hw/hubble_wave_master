const { Client } = require('pg');
const argon2 = require('argon2');
require('dotenv').config();

async function seedSimple() {
  console.log('🌱 Seeding acme tenant (simplified)...\n');

  const platformClient = new Client({
    host: process.env.PLATFORM_DB_HOST || 'localhost',
    port: parseInt(process.env.PLATFORM_DB_PORT || '5432'),
    user: process.env.PLATFORM_DB_USER || 'admin',
    password: process.env.PLATFORM_DB_PASSWORD || 'password',
    database: 'eam_global',
  });

  await platformClient.connect();
  console.log('✓ Connected to platform DB');

  const tenantCheck = await platformClient.query(
    `SELECT id FROM tenants WHERE slug = $1`,
    ['acme']
  );

  if (tenantCheck.rows.length === 0) {
    await platformClient.query(
      `INSERT INTO tenants (slug, name, db_host, db_port, db_name, db_user, db_password_enc, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())`,
      ['acme', 'Acme Corporation', 'localhost', 5432, 'eam_tenant_acme', 'admin', 'password', 'ACTIVE']
    );
    console.log('✓ Created acme tenant');
  } else {
    console.log('✓ Acme tenant exists');
  }

  await platformClient.end();

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
  const roleResult = await tenantClient.query(
    `INSERT INTO roles (name, description) VALUES ($1, $2) RETURNING id`,
    ['admin', 'System Administrator']
  );
  const roleId = roleResult.rows[0].id;
  console.log('✓ Created admin role');

  // Create admin user
  const passwordHash = await argon2.hash('password');
  const userResult = await tenantClient.query(
    `INSERT INTO user_accounts (username, email, "displayName", "authSource", "passwordHash", status)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    ['admin', 'admin@acme.com', 'System Administrator', 'LOCAL', passwordHash, 'ACTIVE']
  );
  const userId = userResult.rows[0].id;
  console.log('✓ Created admin user');

  // Assign role
  await tenantClient.query(
    `INSERT INTO user_role_assignments ("userId", "roleId") VALUES ($1, $2)`,
    [userId, roleId]
  );
  console.log('✓ Assigned admin role');

  await tenantClient.end();

  console.log('\n✅ Seeding complete!');
  console.log('\n📝 Test Credentials:');
  console.log('   Tenant: acme');
  console.log('   Username: admin');
  console.log('   Password: password');
}

seedSimple().catch((error) => {
  console.error('❌ Error:', error.message);
  console.error(error);
  process.exit(1);
});
