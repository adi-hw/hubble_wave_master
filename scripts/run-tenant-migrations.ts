/**
 * Script to run tenant database migrations
 * Uses CommonJS-compatible TypeORM data source
 */
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { join } from 'path';

// Import all migration classes explicitly
import { CreateNavigationTables1785000000000 } from '../migrations/tenant/1785000000000-create-navigation-tables';
import { EnhanceNavProfileItems1785000001000 } from '../migrations/tenant/1785000001000-enhance-nav-profile-items';
import { SeedPlatformNavigation1785000002000 } from '../migrations/tenant/1785000002000-seed-platform-navigation';
import { UpdateNavTemplateVisibility1785000003000 } from '../migrations/tenant/1785000003000-update-nav-template-visibility';

async function runMigrations() {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.PGHOST || 'localhost',
    port: Number(process.env.PGPORT || 5432),
    username: process.env.PGUSER || 'admin',
    password: process.env.PGPASSWORD || 'password',
    database: process.env.PGDATABASE || 'eam_tenant_acme',
    entities: [],
    migrations: [
      CreateNavigationTables1785000000000,
      EnhanceNavProfileItems1785000001000,
      SeedPlatformNavigation1785000002000,
      UpdateNavTemplateVisibility1785000003000,
    ],
    migrationsTableName: 'migrations',
    logging: true,
  });

  try {
    console.log('Connecting to database...');
    await dataSource.initialize();
    console.log('Connected!');

    console.log('Running migrations...');
    const migrations = await dataSource.runMigrations({ transaction: 'all' });

    if (migrations.length === 0) {
      console.log('No pending migrations to run.');
    } else {
      console.log(`Successfully ran ${migrations.length} migration(s):`);
      migrations.forEach((m) => console.log(`  - ${m.name}`));
    }

    await dataSource.destroy();
    console.log('Done!');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

runMigrations();
