import { DataSource } from 'typeorm';
import { Tenant } from '../libs/platform-db/src/lib/entities/tenant.entity';
import * as dotenv from 'dotenv';

dotenv.config();

export const PlatformDataSource = new DataSource({
  type: 'postgres',
  host: process.env.PLATFORM_DB_HOST || process.env.DB_HOST || 'localhost',
  port: Number(process.env.PLATFORM_DB_PORT || process.env.DB_PORT || 5432),
  username: process.env.PLATFORM_DB_USER || process.env.DB_USER || 'admin',
  password: process.env.PLATFORM_DB_PASSWORD || process.env.DB_PASSWORD || 'password',
  database: process.env.PLATFORM_DB_NAME || process.env.DB_NAME || 'eam_global',
  entities: [Tenant],
  migrations: ['./migrations/platform/*.ts'],
  synchronize: false,
});
