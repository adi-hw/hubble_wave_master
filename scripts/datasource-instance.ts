export {};

require('dotenv').config();
require('reflect-metadata');
const { DataSource } = require('typeorm');
const { join } = require('path');

const isProduction = process.env.NODE_ENV === 'production';
const migrationsPath = isProduction
  ? join(process.cwd(), 'dist', 'migrations', 'instance', '*.js')
  : join(process.cwd(), 'migrations', 'instance', '*.ts');

const dbPassword = process.env.DB_PASSWORD;
if (!dbPassword) {
  throw new Error(
    'DB_PASSWORD env var is required to run instance migrations. ' +
      'See SECRETS_ROTATION.md for credential management.'
  );
}

// SSL: production requires certificate validation. Non-production may opt out
// via DB_SSL_REJECT_UNAUTHORIZED=false for local self-signed setups.
const sslEnabled = process.env.DB_SSL === 'true';
const sslRejectUnauthorized = isProduction
  ? true
  : process.env.DB_SSL_REJECT_UNAUTHORIZED === 'true';

const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  username: process.env.DB_USER || 'hubblewave',
  password: dbPassword,
  database: process.env.DB_NAME || 'hubblewave',
  ssl: sslEnabled
    ? {
        rejectUnauthorized: sslRejectUnauthorized,
        ca: process.env.DB_SSL_CA || undefined,
      }
    : false,
  entities: [],
  migrations: [
    migrationsPath,
    // Exclude co-located spec files so TypeORM does not attempt to load them
    // as migrations. Defense-in-depth: the spec file should live in
    // libs/instance-db/src/lib/migrations/ but this guard survives drift.
    `!${isProduction
      ? migrationsPath.replace('*.js', '*.spec.js')
      : migrationsPath.replace('*.ts', '*.spec.ts')}`,
  ],
  migrationsTableName: 'migrations',
  // 'each' allows individual migrations to declare `transaction = false`
  // (required for CREATE INDEX CONCURRENTLY — canon W6.B, F136 PR-3).
  // With 'all', TypeORM rejects any migration that overrides the mode.
  migrationsTransactionMode: 'each',
});

module.exports = dataSource;
module.exports.default = dataSource;
