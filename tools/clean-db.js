const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function setupDatabases() {
  console.log('🗑️  Cleaning existing databases...\n');

  // Clean eam_global
  const platformClient = new Client({
    host: process.env.PLATFORM_DB_HOST || 'localhost',
    port: parseInt(process.env.PLATFORM_DB_PORT || '5432'),
    user: process.env.PLATFORM_DB_USER || 'admin',
    password: process.env.PLATFORM_DB_PASSWORD || 'password',
    database: 'eam_global',
  });

  try {
    await platformClient.connect();
    console.log('✓ Connected to eam_global');
    
    // Get all tables
    const tablesResult = await platformClient.query(`
      SELECT tablename FROM pg_tables 
      WHERE schemaname = 'public'
    `);
    
    for (const row of tablesResult.rows) {
      await platformClient.query(`DROP TABLE IF EXISTS "${row.tablename}" CASCADE`);
    }
    
    console.log(`✓ Dropped ${tablesResult.rows.length} tables from eam_global\n`);
  } catch (error) {
    console.error('Error cleaning eam_global:', error.message);
  } finally {
    await platformClient.end();
  }

  // Clean eam_tenant_acme
  const tenantClient = new Client({
    host: process.env.TENANT_DB_HOST || 'localhost',
    port: parseInt(process.env.TENANT_DB_PORT || '5432'),
    user: process.env.TENANT_DB_USER || 'admin',
    password: process.env.TENANT_DB_PASSWORD || 'password',
    database: 'eam_tenant_acme',
  });

  try {
    await tenantClient.connect();
    console.log('✓ Connected to eam_tenant_acme');
    
    // Get all tables
    const tablesResult = await tenantClient.query(`
      SELECT tablename FROM pg_tables 
      WHERE schemaname = 'public'
    `);
    
    for (const row of tablesResult.rows) {
      await tenantClient.query(`DROP TABLE IF EXISTS "${row.tablename}" CASCADE`);
    }
    
    console.log(`✓ Dropped ${tablesResult.rows.length} tables from eam_tenant_acme\n`);
  } catch (error) {
    console.error('Error cleaning eam_tenant_acme:', error.message);
  } finally {
    await tenantClient.end();
  }

  console.log('✅ Database cleanup complete!');
  console.log('\nNext: Run migrations using TypeORM CLI');
}

setupDatabases().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
