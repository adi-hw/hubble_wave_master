export {};

require('dotenv').config();
require('reflect-metadata');
const { DataSource } = require('typeorm');
const { join } = require('path');
const { controlPlaneEntities } = require('../libs/control-plane-db/src/lib/entities/index');

const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';
const dbPassword = process.env.CONTROL_PLANE_DB_PASSWORD;

if (!dbPassword) {
  throw new Error(
    'CONTROL_PLANE_DB_PASSWORD env var is required. ' +
      'See SECRETS_ROTATION.md for credential management.'
  );
}

const migrationsGlob =
  process.env.CONTROL_PLANE_MIGRATIONS_GLOB ||
  join(process.cwd(), 'migrations', 'control-plane', '*.ts');

const useSsl = (process.env.DB_SSL || 'false') === 'true';
// Production requires certificate validation. Non-production may opt out
// via DB_SSL_REJECT_UNAUTHORIZED=false for local self-signed setups.
const sslRejectUnauthorized = isProduction
  ? true
  : process.env.DB_SSL_REJECT_UNAUTHORIZED === 'true';

const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.CONTROL_PLANE_DB_HOST || 'localhost',
  port: Number(process.env.CONTROL_PLANE_DB_PORT || 5432),
  username: process.env.CONTROL_PLANE_DB_USER || 'hubblewave',
  password: dbPassword,
  database: process.env.CONTROL_PLANE_DB_NAME || 'hubblewave_control_plane',
  entities: controlPlaneEntities,
  migrations: [
    migrationsGlob,
    // Exclude co-located spec files so TypeORM does not attempt to load them
    // as migrations. Defense-in-depth against future drift.
    `!${migrationsGlob.replace('*.ts', '*.spec.ts').replace('*.js', '*.spec.js')}`,
  ],
  migrationsTableName: 'migrations',
  // 'each' allows individual migrations to declare `transaction = false`
  // (required for CREATE INDEX CONCURRENTLY — canon W6.B, F136 PR-3).
  // With 'all', TypeORM rejects any migration that overrides the mode.
  migrationsTransactionMode: 'each',
  ssl: useSsl
    ? {
        rejectUnauthorized: sslRejectUnauthorized,
        ca: process.env.DB_SSL_CA || undefined,
      }
    : false,
});

module.exports = dataSource;
module.exports.default = dataSource;
