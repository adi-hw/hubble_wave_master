const { Client } = require('pg');
require('dotenv').config();

async function checkTables() {
  console.log('🔍 Checking database tables...\n');

  // Check platform DB
  const platformClient = new Client({
    host: process.env.PLATFORM_DB_HOST || 'localhost',
    port: parseInt(process.env.PLATFORM_DB_PORT || '5432'),
    user: process.env.PLATFORM_DB_USER || 'admin',
    password: process.env.PLATFORM_DB_PASSWORD || 'password',
    database: 'eam_global',
  });

  await platformClient.connect();
  console.log('📊 Platform DB (eam_global):');
  
  const platformTables = await platformClient.query(`
    SELECT tablename FROM pg_tables 
    WHERE schemaname = 'public'
    ORDER BY tablename
  `);
  
  if (platformTables.rows.length === 0) {
    console.log('   ⚠️  No tables found!');
  } else {
    platformTables.rows.forEach(row => {
      console.log(`   ✓ ${row.tablename}`);
    });
  }
  
  await platformClient.end();

  // Check tenant DB
  const tenantClient = new Client({
    host: process.env.TENANT_DB_HOST || 'localhost',
    port: parseInt(process.env.TENANT_DB_PORT || '5432'),
    user: process.env.TENANT_DB_USER || 'admin',
    password: process.env.TENANT_DB_PASSWORD || 'password',
    database: 'eam_tenant_acme',
  });

  await tenantClient.connect();
  console.log('\n📊 Tenant DB (eam_tenant_acme):');
  
  const tenantTables = await tenantClient.query(`
    SELECT tablename FROM pg_tables 
    WHERE schemaname = 'public'
    ORDER BY tablename
  `);
  
  if (tenantTables.rows.length === 0) {
    console.log('   ⚠️  No tables found!');
  } else {
    tenantTables.rows.forEach(row => {
      console.log(`   ✓ ${row.tablename}`);
    });
  }
  
  await tenantClient.end();

  console.log('\n💡 Note: If no tables found, migrations need to be run manually.');
}

checkTables().catch((error) => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
