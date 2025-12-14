const { Client } = require('pg');
const argon2 = require('argon2');
require('dotenv').config();

async function seedSimple() {
  console.log('Seeding acme tenant (simplified)...\n');

  const platformClient = new Client({
    host: process.env.PLATFORM_DB_HOST || 'localhost',
    port: parseInt(process.env.PLATFORM_DB_PORT || '5432'),
    user: process.env.PLATFORM_DB_USER || 'admin',
    password: process.env.PLATFORM_DB_PASSWORD || 'password',
    database: 'eam_global',
  });

  await platformClient.connect();
  console.log('Connected to platform DB');

  // Check/create tenant
  const tenantCheck = await platformClient.query(
    `SELECT id FROM tenants WHERE slug = $1`,
    ['acme']
  );

  let tenantId;
  if (tenantCheck.rows.length === 0) {
    const tenantResult = await platformClient.query(
      `INSERT INTO tenants (slug, name, db_host, db_port, db_name, db_user, db_password_enc, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW()) RETURNING id`,
      ['acme', 'Acme Corporation', 'localhost', 5432, 'eam_tenant_acme', 'admin', 'password', 'ACTIVE']
    );
    tenantId = tenantResult.rows[0].id;
    console.log('Created acme tenant');
  } else {
    tenantId = tenantCheck.rows[0].id;
    console.log('Acme tenant exists');
  }

  // Check/create admin user in platform DB
  const userCheck = await platformClient.query(
    `SELECT id FROM user_accounts WHERE primary_email = $1`,
    ['admin@acme.com']
  );

  let userId;
  if (userCheck.rows.length === 0) {
    const passwordHash = await argon2.hash('password');
    const userResult = await platformClient.query(
      `INSERT INTO user_accounts (primary_email, display_name, password_hash, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW()) RETURNING id`,
      ['admin@acme.com', 'System Administrator', passwordHash, 'ACTIVE']
    );
    userId = userResult.rows[0].id;
    console.log('Created admin user in platform DB');
  } else {
    userId = userCheck.rows[0].id;
    console.log('Admin user exists in platform DB');
  }

  // Check/create tenant membership
  const membershipCheck = await platformClient.query(
    `SELECT id FROM tenant_user_memberships WHERE tenant_id = $1 AND user_id = $2`,
    [tenantId, userId]
  );

  let membershipId;
  if (membershipCheck.rows.length === 0) {
    const membershipResult = await platformClient.query(
      `INSERT INTO tenant_user_memberships (tenant_id, user_id, status, is_tenant_admin, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW()) RETURNING id`,
      [tenantId, userId, 'ACTIVE', true]
    );
    membershipId = membershipResult.rows[0].id;
    console.log('Created tenant membership');
  } else {
    membershipId = membershipCheck.rows[0].id;
    console.log('Tenant membership exists');
  }

  // Check/create role and assignment
  const roleCheck = await platformClient.query(
    `SELECT id FROM roles WHERE name = $1 AND tenant_id = $2`,
    ['admin', tenantId]
  );

  let roleId;
  if (roleCheck.rows.length === 0) {
    const roleResult = await platformClient.query(
      `INSERT INTO roles (name, slug, description, tenant_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW()) RETURNING id`,
      ['admin', 'admin', 'System Administrator', tenantId]
    );
    roleId = roleResult.rows[0].id;
    console.log('Created admin role');
  } else {
    roleId = roleCheck.rows[0].id;
    console.log('Admin role exists');
  }

  // Assign role to membership
  const assignmentCheck = await platformClient.query(
    `SELECT id FROM user_role_assignments WHERE tenant_user_membership_id = $1 AND role_id = $2`,
    [membershipId, roleId]
  );

  if (assignmentCheck.rows.length === 0) {
    await platformClient.query(
      `INSERT INTO user_role_assignments (tenant_user_membership_id, role_id, created_at, updated_at)
       VALUES ($1, $2, NOW(), NOW())`,
      [membershipId, roleId]
    );
    console.log('Assigned admin role to user');
  } else {
    console.log('Role assignment exists');
  }

  await platformClient.end();

  // Now seed tenant DB
  const tenantClient = new Client({
    host: process.env.TENANT_DB_HOST || 'localhost',
    port: parseInt(process.env.TENANT_DB_PORT || '5432'),
    user: process.env.TENANT_DB_USER || 'admin',
    password: process.env.TENANT_DB_PASSWORD || 'password',
    database: 'eam_tenant_acme',
  });

  await tenantClient.connect();
  console.log('Connected to tenant DB');

  // Create tenant_users entry
  const tenantUserCheck = await tenantClient.query(
    `SELECT id FROM tenant_users WHERE user_account_id = $1`,
    [userId]
  );

  if (tenantUserCheck.rows.length === 0) {
    await tenantClient.query(
      `INSERT INTO tenant_users (user_account_id, display_name, status, is_tenant_admin, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())`,
      [userId, 'System Administrator', 'active', true]
    );
    console.log('Created tenant_users entry');
  } else {
    console.log('tenant_users entry exists');
  }

  await tenantClient.end();

  console.log('\nSeeding complete!');
  console.log('\nTest Credentials:');
  console.log('   Tenant: acme');
  console.log('   Email: admin@acme.com');
  console.log('   Password: password');
}

seedSimple().catch((error) => {
  console.error('Error:', error.message);
  console.error(error);
  process.exit(1);
});
