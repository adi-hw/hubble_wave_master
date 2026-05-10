import { DataSource, DataSourceOptions } from 'typeorm';

/**
 * Spins up a TypeORM DataSource pointed at a per-test-run Postgres database.
 * Uses the existing docker-compose Postgres on localhost:5432.
 *
 * Database name: `hw_test_<random>` (ensures isolation between concurrent runs).
 * Caller is responsible for calling `dataSource.destroy()` and dropping the DB
 * via the returned `cleanup` function.
 */
export async function createTestDataSource(opts?: {
  entities?: DataSourceOptions['entities'];
}): Promise<{ dataSource: DataSource; cleanup: () => Promise<void> }> {
  const dbName = `hw_test_${Math.random().toString(36).slice(2, 10)}`;

  // Connect to the default Postgres to create the per-test database.
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

  // Connect to the per-test database with the entities under test.
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.POSTGRES_HOST ?? 'localhost',
    port: parseInt(process.env.POSTGRES_PORT ?? '5432', 10),
    username: process.env.POSTGRES_USER ?? 'postgres',
    password: process.env.POSTGRES_PASSWORD ?? 'postgres',
    database: dbName,
    entities: opts?.entities ?? [],
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
