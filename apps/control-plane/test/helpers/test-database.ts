import { DataSource, DataSourceOptions } from 'typeorm';

/**
 * Spins up a TypeORM DataSource pointed at a per-test-run control-plane
 * Postgres database. Mirrors the helper at
 * `apps/api/test/helpers/test-database.ts` but defaults to the
 * `public` schema (the control-plane DB has no `identity` schema —
 * canon §18 + see `migrations/control-plane/`).
 *
 * Database name: `cp_test_<random>` (ensures isolation between concurrent
 * runs). Caller is responsible for calling the returned `cleanup` to
 * drop the database after the test suite completes.
 */
export async function createTestDataSource(opts?: {
  entities?: DataSourceOptions['entities'];
  subscribers?: DataSourceOptions['subscribers'];
  schemas?: string[];
}): Promise<{ dataSource: DataSource; cleanup: () => Promise<void> }> {
  const dbName = `cp_test_${Math.random().toString(36).slice(2, 10)}`;

  const adminDs = new DataSource({
    type: 'postgres',
    host: process.env.POSTGRES_HOST ?? 'localhost',
    port: parseInt(process.env.POSTGRES_PORT ?? '5432', 10),
    username: process.env.POSTGRES_USER ?? 'postgres',
    password: process.env.POSTGRES_PASSWORD ?? 'postgres',
    database: 'postgres',
  });
  await adminDs.initialize();
  await adminDs.query(`CREATE DATABASE "${dbName}"`);
  await adminDs.destroy();

  const schemas = opts?.schemas ?? [];
  if (schemas.length > 0) {
    const schemaBootstrap = new DataSource({
      type: 'postgres',
      host: process.env.POSTGRES_HOST ?? 'localhost',
      port: parseInt(process.env.POSTGRES_PORT ?? '5432', 10),
      username: process.env.POSTGRES_USER ?? 'postgres',
      password: process.env.POSTGRES_PASSWORD ?? 'postgres',
      database: dbName,
    });
    await schemaBootstrap.initialize();
    for (const schema of schemas) {
      await schemaBootstrap.query(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
    }
    await schemaBootstrap.destroy();
  }

  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.POSTGRES_HOST ?? 'localhost',
    port: parseInt(process.env.POSTGRES_PORT ?? '5432', 10),
    username: process.env.POSTGRES_USER ?? 'postgres',
    password: process.env.POSTGRES_PASSWORD ?? 'postgres',
    database: dbName,
    entities: opts?.entities ?? [],
    subscribers: opts?.subscribers ?? [],
    synchronize: true, // OK in tests; never in prod
  });
  await dataSource.initialize();

  const cleanup = async () => {
    await dataSource.destroy();
    const ds = new DataSource({
      type: 'postgres',
      host: process.env.POSTGRES_HOST ?? 'localhost',
      port: parseInt(process.env.POSTGRES_PORT ?? '5432', 10),
      username: process.env.POSTGRES_USER ?? 'postgres',
      password: process.env.POSTGRES_PASSWORD ?? 'postgres',
      database: 'postgres',
    });
    await ds.initialize();
    await ds.query(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`);
    await ds.destroy();
  };

  return { dataSource, cleanup };
}
