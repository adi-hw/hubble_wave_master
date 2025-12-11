import { DataSource } from 'typeorm';
import { Client } from 'pg';
import * as dotenv from 'dotenv';
import 'tsconfig-paths/register';

dotenv.config();

async function cleanAndMigrate() {
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
    await platformClient.query('DROP SCHEMA IF EXISTS public CASCADE');
    await platformClient.query('CREATE SCHEMA public');
    console.log('✓ Cleaned eam_global schema\n');
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
    await tenantClient.query('DROP SCHEMA IF EXISTS public CASCADE');
    await tenantClient.query('CREATE SCHEMA public');
    console.log('✓ Cleaned eam_tenant_acme schema\n');
  } finally {
    await tenantClient.end();
  }

  console.log('📦 Running platform migration...\n');

  // Run platform migration
  const CreateTenants = await import('../migrations/platform/1764720000000-create-tenants');
  const InitPlatform = await import('../migrations/platform/1764729684806-init-platform');
  const AddPlatformAuth = await import('../migrations/platform/1765300005000-add-platform-auth-schema');

  const platformDataSource = new DataSource({
    type: 'postgres',
    host: process.env.PLATFORM_DB_HOST || 'localhost',
    port: parseInt(process.env.PLATFORM_DB_PORT || '5432'),
    username: process.env.PLATFORM_DB_USER || 'admin',
    password: process.env.PLATFORM_DB_PASSWORD || 'password',
    database: 'eam_global',
    entities: [],
    migrations: [
      CreateTenants.CreateTenants1764720000000,
      InitPlatform.InitPlatform1764729684806,
      AddPlatformAuth.AddPlatformAuthSchema1765300005000,
    ],
    synchronize: false,
  });

  try {
    await platformDataSource.initialize();
    console.log('✓ Platform DataSource initialized');
    await platformDataSource.runMigrations();
    console.log('✓ Platform migration completed\n');
  } finally {
    await platformDataSource.destroy();
  }

  console.log('📦 Running tenant migration...\n');

  // Run tenant migration
  const CreateTenantBaseline = await import('../migrations/tenant/1765300007000-create-tenant-business-schema');
  const InitTenant = await import('../migrations/tenant/1764729687516-init-tenant');
  const DropTenantAuth = await import('../migrations/tenant/1765300006000-drop-auth-from-tenant');
  const SeedDefaultModels = await import('../migrations/tenant/1765300008000-seed-default-models');
  const FixStoragePaths = await import('../migrations/tenant/1765300009000-fix-storage-paths');
  const SeedModulesModel = await import('../migrations/tenant/1765300010000-seed-modules-model');
  const SeedModelTableModel = await import('../migrations/tenant/1765300011000-seed-model-table-model');

  const tenantDataSource = new DataSource({
    type: 'postgres',
    host: process.env.TENANT_DB_HOST || 'localhost',
    port: parseInt(process.env.TENANT_DB_PORT || '5432'),
    username: process.env.TENANT_DB_USER || 'admin',
    password: process.env.TENANT_DB_PASSWORD || 'password',
    database: 'eam_tenant_acme',
    entities: [],
    migrations: [
      CreateTenantBaseline.CreateTenantBusinessSchema1765300007000,
      InitTenant.InitTenant1764729687516,
      DropTenantAuth.DropAuthFromTenant1765300006000,
      SeedDefaultModels.SeedDefaultModels1765300008000,
      FixStoragePaths.FixStoragePaths1765300009000,
      SeedModulesModel.SeedModulesModel1765300010000,
      SeedModelTableModel.SeedModelTableModel1765300011000,
    ],
    synchronize: false,
  });

  try {
    await tenantDataSource.initialize();
    console.log('✓ Tenant DataSource initialized');
    await tenantDataSource.runMigrations();
    console.log('✓ Tenant migration completed\n');
  } finally {
    await tenantDataSource.destroy();
  }

  console.log('✅ Database setup complete!');
  console.log('\nNext steps:');
  console.log('1. Run seed script to create acme tenant and admin user');
  console.log('2. Start services: npm run dev:all');
  console.log('3. Test login at http://localhost:4200/login');
}

cleanAndMigrate().catch((error) => {
  console.error('❌ Error during migration:', error);
  process.exit(1);
});
