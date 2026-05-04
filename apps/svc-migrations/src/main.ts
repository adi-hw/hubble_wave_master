import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { instanceEntities } from '@hubblewave/instance-db';

/**
 * Instance Database Migration Runner
 *
 * Single-shot job that applies pending TypeORM migrations to the customer
 * instance database. Designed to be deployed as a Kubernetes Job (or ECS
 * Task) ahead of application pods, so application services no longer race
 * each other to run migrations on startup.
 *
 * The runner serialises concurrent invocations via a Postgres advisory lock
 * keyed on `LOCK_KEY`. If another migrator already holds the lock, this
 * process exits with a non-zero status without touching the database.
 *
 * Configuration is via environment variables (mirrors InstanceDbModule):
 * - DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME
 * - DB_SSL: enables TLS to the database
 * - DB_SSL_CA: optional PEM bundle injected as the trust anchor
 * - DB_SSL_REJECT_UNAUTHORIZED: opt-out of certificate verification
 *   (defaults to the same posture as InstanceDbModule)
 */
const LOCK_KEY = 'hubblewave_instance_migrations';

type SslConfig = false | { rejectUnauthorized: boolean; ca?: string };

function buildSslConfig(): SslConfig {
  if (process.env.DB_SSL !== 'true') {
    return false;
  }

  const rejectUnauthorized =
    process.env.DB_SSL_REJECT_UNAUTHORIZED === undefined
      ? false
      : process.env.DB_SSL_REJECT_UNAUTHORIZED === 'true';

  const ca = process.env.DB_SSL_CA;
  if (ca && ca.length > 0) {
    return { rejectUnauthorized, ca };
  }

  return { rejectUnauthorized };
}

async function main(): Promise<void> {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST ?? 'localhost',
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    username: process.env.DB_USER ?? 'hubblewave',
    password: process.env.DB_PASSWORD ?? 'hubblewave',
    database: process.env.DB_NAME ?? 'hubblewave',
    entities: instanceEntities,
    migrations: ['dist/migrations/instance/*.js'],
    migrationsTableName: 'migrations',
    ssl: buildSslConfig(),
  });

  await dataSource.initialize();

  try {
    const lockResult = await dataSource.query(
      'SELECT pg_try_advisory_lock(hashtext($1)) AS locked',
      [LOCK_KEY],
    );

    if (!lockResult?.[0]?.locked) {
      console.error(
        `Could not acquire migration advisory lock '${LOCK_KEY}'. Another migrator is already running.`,
      );
      process.exit(1);
    }

    try {
      const ran = await dataSource.runMigrations();
      // Progress output goes to stderr (console.warn) so it surfaces in
      // operator log streams without being mistaken for application data.
      console.warn(`Applied ${ran.length} migration(s).`);
      for (const migration of ran) {
        console.warn(`  - ${migration.name}`);
      }
    } finally {
      await dataSource.query('SELECT pg_advisory_unlock(hashtext($1))', [
        LOCK_KEY,
      ]);
    }
  } finally {
    await dataSource.destroy();
  }
}

main().catch((err) => {
  console.error('Migration job failed:', err);
  process.exit(1);
});
