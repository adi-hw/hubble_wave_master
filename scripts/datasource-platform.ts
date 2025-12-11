import { DataSource } from 'typeorm';
import { join } from 'path';

export default new DataSource({
  type: 'postgres',
  host: process.env.PGHOST || 'localhost',
  port: Number(process.env.PGPORT || 5432),
  username: process.env.PGUSER || 'admin',
  password: process.env.PGPASSWORD || 'password',
  database: process.env.PGDATABASE || 'eam_global',
  entities: [join(__dirname, '..', 'libs', 'platform-db', 'src', 'lib', 'entities', '**', '*.ts')],
  migrations: [
    join(__dirname, '..', 'migrations', 'platform', '1777*.ts'),
    join(__dirname, '..', 'migrations', 'platform', '1778*.ts'),
  ],
});
