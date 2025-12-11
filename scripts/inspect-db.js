const { Client } = require('pg');

async function inspect() {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER || 'admin',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_NAME || 'eam_global',
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    // Check user_accounts columns
    const columns = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'user_accounts'
      ORDER BY ordinal_position
    `);
    
    console.log('\n📋 user_accounts columns:');
    columns.rows.forEach(col => {
      console.log(`  - ${col.column_name} (${col.data_type})`);
    });

    // Check existing tenants
    const tenants = await client.query('SELECT id, slug FROM tenants');
    console.log('\n🏢 Existing tenants:');
    tenants.rows.forEach(t => console.log(`  - ${t.slug} (${t.id})`));

    // Check existing roles
    const roles = await client.query('SELECT id, name, "tenantId" FROM roles');
    console.log('\n👥 Existing roles:');
    roles.rows.forEach(r => console.log(`  - ${r.name} for tenant ${r.tenantId} (${r.id})`));

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

inspect();
