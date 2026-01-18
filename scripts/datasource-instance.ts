export {};

require('dotenv').config();
require('reflect-metadata');
const { DataSource } = require('typeorm');
const { join } = require('path');

const isProduction = process.env.NODE_ENV === 'production';
const migrationsPath = isProduction
  ? join(process.cwd(), 'dist', 'migrations', 'instance', '*.js')
  : join(process.cwd(), 'migrations', 'instance', '*.ts');

const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  username: process.env.DB_USER || 'hubblewave',
  password: process.env.DB_PASSWORD || 'hubblewave',
  database: process.env.DB_NAME || 'hubblewave',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  entities: [],
  migrations: [migrationsPath],
  migrationsTableName: 'migrations',
});

module.exports = dataSource;
module.exports.default = dataSource;
