import { DataSource } from 'typeorm';
import { join } from 'path';

// Use process.cwd() for ESM compatibility
const migrationsPath = join(process.cwd(), 'migrations', 'tenant', '*.ts');

export default new DataSource({
  type: 'postgres',
  host: process.env.PGHOST || 'localhost',
  port: Number(process.env.PGPORT || 5432),
  username: process.env.PGUSER || 'admin',
  password: process.env.PGPASSWORD || 'password',
  database: process.env.PGDATABASE || 'eam_tenant_acme',
  entities: [], // Entities not needed for migrations
  migrations: [migrationsPath],
  migrationsTableName: 'migrations',
});
