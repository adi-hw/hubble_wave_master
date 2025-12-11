const { Client } = require('pg');
const argon2 = require('argon2');

async function seed() {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER || 'admin',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_NAME || 'eam_global',
  });

  try {
    await client.connect();
    console.log('✅ Database connection established');

    // Get existing tenant
    const tenantResult = await client.query(`SELECT id FROM tenants WHERE slug = 'acme' LIMIT 1`);
    if (tenantResult.rows.length === 0) {
      throw new Error('No tenant with slug "acme" found. Please run migration first.');
    }
    const tenantId = tenantResult.rows[0].id;
    console.log(`✅ Found tenant: ${tenantId}`);

    // Get or create admin role
    let roleResult = await client.query(`SELECT id FROM roles WHERE name = 'admin' AND "tenantId" = $1 LIMIT 1`, [tenantId]);
    let roleId;
    
    if (roleResult.rows.length === 0) {
      roleResult = await client.query(
        `INSERT INTO roles (id, name, description, "tenantId")
         VALUES (gen_random_uuid(), $1, $2, $3)
         RETURNING id`,
        ['admin', 'Administrator role', tenantId]
      );
      roleId = roleResult.rows[0].id;
      console.log(`✅ Created admin role: ${roleId}`);
    } else {
      roleId = roleResult.rows[0].id;
      console.log(`✅ Found admin role: ${roleId}`);
    }

    // Hash the password
    const passwordHash = await argon2.hash('Admin123!');

    // Create or update test user
    const userResult = await client.query(
      `INSERT INTO user_accounts (id, username, email, "displayName", "authSource", "passwordHash", "tenantId", status)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT ("tenantId", username) DO UPDATE
       SET email = EXCLUDED.email, "passwordHash" = EXCLUDED."passwordHash"
       RETURNING id`,
      ['admin', 'admin@test.com', 'Admin User', 'LOCAL', passwordHash, tenantId, 'ACTIVE']
    );
    const userId = userResult.rows[0].id;
    console.log(`✅ Created/Updated admin user: ${userId}`);

    // Assign admin role to user
    await client.query(
      `INSERT INTO user_role_assignments (id, "userId", "roleId")
       VALUES (gen_random_uuid(), $1, $2)
       ON CONFLICT DO NOTHING`,
      [userId, roleId]
    );
    console.log('✅ Assigned admin role to user');

    console.log('\n🎉 Test account created successfully!');
    console.log('📧 Email: admin@test.com');
    console.log('👤 Username: admin');
    console.log('🔑 Password: Admin123!');
    console.log('🏢 Tenant: test');
    console.log('\nYou can now login at http://localhost:4200/login');

  } catch (error) {
    console.error('❌ Error seeding database:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

seed();
// @deprecated: replaced by seed-test-user.ts; safe to delete after 2025-01-01
