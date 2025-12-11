const { DataSource } = require('typeorm');
const path = require('path');
require('dotenv').config();

async function runMigrations() {
  console.log('📦 Running Platform Migration...\n');
  
  // Platform DataSource
  const PlatformDataSource = new DataSource({
    type: 'postgres',
    host: process.env.PLATFORM_DB_HOST || 'localhost',
    port: Number(process.env.PLATFORM_DB_PORT || 5432),
    username: process.env.PLATFORM_DB_USER || 'admin',
    password: process.env.PLATFORM_DB_PASSWORD || 'password',
    database: process.env.PLATFORM_DB_NAME || 'eam_global',
    entities: [path.join(__dirname, '../dist/libs/platform-db/src/lib/entities/*.js')],
    migrations: [path.join(__dirname, '../migrations/platform/*.js')],
    synchronize: false,
   logging: true,
  });

  try {
    await PlatformDataSource.initialize();
    console.log('✓ Platform DataSource initialized');
    
    const migrations = await PlatformDataSource.runMigrations();
    console.log(`✓ Ran ${migrations.length} platform migration(s)\n`);
    
    await PlatformDataSource.destroy();
  } catch (error) {
    console.error('❌ Platform migration failed:', error.message);
    process.exit(1);
  }

  console.log('📦 Running Tenant Migration...\n');
  
  // Tenant DataSource
  const TenantDataSource = new DataSource({
    type: 'postgres',
    host: process.env.TENANT_DB_HOST || 'localhost',
    port: Number(process.env.TENANT_DB_PORT || 5432),
    username: process.env.TENANT_DB_USER || 'admin',
    password: process.env.TENANT_DB_PASSWORD || 'password',
    database: 'eam_tenant_acme',
    entities: [path.join(__dirname, '../dist/libs/tenant-db/src/lib/entities/*.js')],
    migrations: [path.join(__dirname, '../migrations/tenant/*.js')],
    synchronize: false,
    logging: true,
  });

  try {
    await TenantDataSource.initialize();
    console.log('✓ Tenant DataSource initialized');
    
    const migrations = await TenantDataSource.runMigrations();
    console.log(`✓ Ran ${migrations.length} tenant migration(s)\n`);
    
    await TenantDataSource.destroy();
  } catch (error) {
    console.error('❌ Tenant migration failed:', error.message);
    process.exit(1);
  }

  console.log('✅ All migrations complete!');
}

runMigrations();
