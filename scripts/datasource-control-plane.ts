require('dotenv').config();
require('reflect-metadata');
const { DataSource } = require('typeorm');
const { join } = require('path');
const { controlPlaneEntities } = require('../libs/control-plane-db/src/lib/entities/index');

const nodeEnv = process.env.NODE_ENV || 'development';
const dbPassword = process.env.CONTROL_PLANE_DB_PASSWORD;

if (!dbPassword && nodeEnv === 'production') {
  throw new Error('CONTROL_PLANE_DB_PASSWORD must be set in production');
}

const migrationsGlob =
  process.env.CONTROL_PLANE_MIGRATIONS_GLOB ||
  join(process.cwd(), 'migrations', 'control-plane', '*.ts');

const useSsl = (process.env.DB_SSL || 'false') === 'true';

const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.CONTROL_PLANE_DB_HOST || 'localhost',
  port: Number(process.env.CONTROL_PLANE_DB_PORT || 5432),
  username: process.env.CONTROL_PLANE_DB_USER || 'hubblewave',
  password: dbPassword || 'hubblewave',
  database: process.env.CONTROL_PLANE_DB_NAME || 'hubblewave_control_plane',
  entities: controlPlaneEntities,
  migrations: [migrationsGlob],
  migrationsTableName: 'migrations',
  ssl: useSsl ? { rejectUnauthorized: false } : false,
});

module.exports = dataSource;
module.exports.default = dataSource;
