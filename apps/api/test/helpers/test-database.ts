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
  /**
   * TypeORM subscribers to attach to the per-test datasource. Plan Fix 41
   * / F042 stress test needs `AuditLogSubscriber` registered so the hash-
   * chain extension hook fires; integration tests that only exercise
   * entity behaviour can omit it.
   */
  subscribers?: DataSourceOptions['subscribers'];
  /**
   * Names of Postgres schemas the entities require (e.g. `'identity'`).
   * Schemas are created BEFORE TypeORM's synchronize runs so entity
   * decorators that carry `schema: '...'` resolve cleanly. Defaults to
   * `[]` — tests that only use the `public` schema can omit it.
   */
  schemas?: string[];
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

  // If the entities reference non-public schemas, create them on a
  // schema-only DataSource (no entities) BEFORE the entity-aware
  // DataSource initialises. TypeORM's synchronize would otherwise crash
  // with `schema "X" does not exist` when it tries to CREATE TABLE in a
  // schema the per-test DB has never seen.
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

  // Connect to the per-test database with the entities under test.
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
