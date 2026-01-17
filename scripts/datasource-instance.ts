require('dotenv').config();
require('reflect-metadata');
const { DataSource } = require('typeorm');
const { join } = require('path');

const { instanceEntities } = require('../libs/instance-db/src/lib/entities/index');

const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  username: process.env.DB_USER || 'hubblewave',
  password: process.env.DB_PASSWORD || 'hubblewave',
  database: process.env.DB_NAME || 'hubblewave',
  entities: instanceEntities,
  migrations: [
    join(process.cwd(), 'migrations', 'instance', '*.ts'),
  ],
  migrationsTableName: 'migrations',
});

module.exports = dataSource;
module.exports.default = dataSource;
