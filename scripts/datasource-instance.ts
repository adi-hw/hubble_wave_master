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
  migrations: [migrationsPath],
  migrationsTableName: 'migrations',
});

module.exports = dataSource;
module.exports.default = dataSource;
