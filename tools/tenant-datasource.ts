import { DataSource } from 'typeorm';
import { tenantEntities } from '../libs/tenant-db/src/lib/tenant-db.service';
import * as dotenv from 'dotenv';

dotenv.config();

export const TenantDataSource = new DataSource({
  type: 'postgres',
  host: process.env.TENANT_DB_HOST || process.env.DB_HOST || 'localhost',
  port: Number(process.env.TENANT_DB_PORT || process.env.DB_PORT || 5432),
  username: process.env.TENANT_DB_USER || process.env.DB_USER || 'admin',
  password: process.env.TENANT_DB_PASSWORD || process.env.DB_PASSWORD || 'password',
  database: 'eam_tenant_acme', // Dummy DB for schema generation
  entities: tenantEntities,
  migrations: ['./migrations/tenant/*.ts'],
  synchronize: false,
});
