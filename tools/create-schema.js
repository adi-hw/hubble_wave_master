const { DataSource } = require('typeorm');
const path = require('path');
require('dotenv').config();

async function createSchemaWithSync() {
  console.log('🏗️  Creating tenant schema with TypeORM synchronize...\n');

  const TenantDataSource = new DataSource({
    type: 'postgres',
    host: process.env.TENANT_DB_HOST || 'localhost',
    port: Number(process.env.TENANT_DB_PORT || 5432),
    username: process.env.TENANT_DB_USER || 'admin',
    password: process.env.TENANT_DB_PASSWORD || 'password',
    database: 'eam_tenant_acme',
    entities: [
      path.join(__dirname, '../dist/libs/tenant-db/**/*.entity.js'),
    ],
    synchronize: true, // This will create all tables from entities
    logging: ['error', 'schema'],
  });

  try {
    console.log('📦 Initializing DataSource...');
    await TenantDataSource.initialize();
    console.log('✅ Tenant schema created successfully!');
    
    // List created tables
    const tables = await TenantDataSource.query(`
      SELECT tablename FROM pg_tables 
      WHERE schemaname = 'public' AND tablename != 'migrations'
      ORDER BY tablename
    `);
    
    console.log(`\n✓ Created ${tables.length} tables:`);
    tables.forEach(t => console.log(`   - ${t.tablename}`));
    
    await TenantDataSource.destroy();
  } catch (error) {
    console.error('❌ Failed:', error.message);
    process.exit(1);
  }

  console.log('\n🚀 Next: Run seed script');
  console.log('   node tools/seed-acme.js');
}

createSchemaWithSync();
