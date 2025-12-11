import { Client } from 'pg';
import { PlatformDataSource } from './platform-datasource';
import { TenantDataSource } from './tenant-datasource';
import * as dotenv from 'dotenv';

dotenv.config();

async function createDbIfNotExists(dbName: string) {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER || 'admin',
    password: process.env.DB_PASSWORD || 'password',
    database: 'postgres',
  });

  try {
    await client.connect();
    const res = await client.query(`SELECT 1 FROM pg_database WHERE datname = '${dbName}'`);
    if (res.rowCount === 0) {
      console.log(`Creating database ${dbName}...`);
      await client.query(`CREATE DATABASE "${dbName}"`);
    } else {
      console.log(`Database ${dbName} already exists.`);
    }
  } catch (err) {
    console.error(`Failed to check/create database ${dbName}:`, err);
  } finally {
    await client.end();
  }
}

async function check() {
  await createDbIfNotExists(process.env.PLATFORM_DB_NAME || 'eam_global');
  await createDbIfNotExists('eam_tenant_acme');

  console.log('Checking PlatformDataSource...');
  try {
    await PlatformDataSource.initialize();
    console.log('PlatformDataSource initialized successfully.');
    await PlatformDataSource.destroy();
  } catch (err) {
    console.error('PlatformDataSource failed:', err);
  }

  console.log('Checking TenantDataSource...');
  try {
    await TenantDataSource.initialize();
    console.log('TenantDataSource initialized successfully.');
    await TenantDataSource.destroy();
  } catch (err) {
    console.error('TenantDataSource failed:', err);
  }
}

check();
