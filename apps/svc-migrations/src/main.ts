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

/**
 * F053 (W1 task 3): require explicit env vars. The previous
 * `?? 'hubblewave'` fallbacks meant a misconfigured K8s manifest would
 * silently run migrations against `hubblewave:hubblewave@localhost/
 * hubblewave` — the dev-default credentials shipped in `.env.example`.
 * In production, that lands a successful migration on the wrong target
 * with no surface signal. Fail loud at startup instead.
 *
 * DB_HOST and DB_PORT keep their dev defaults because they're network
 * addresses, not credentials, and the connection failure surfaces
 * immediately if they're wrong. DB_USER / DB_PASSWORD / DB_NAME must
 * be explicit because they SUCCESSFULLY-CONNECTING TO THE WRONG TARGET
 * is the failure mode we're guarding against.
 */
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    throw new Error(
      `svc-migrations: required env var ${name} is not set. ` +
        `Migrations refuse to run without explicit credentials per F053 ` +
        `(see SECRETS_ROTATION.md / canon §5).`,
    );
  }
  return value;
}

async function main(): Promise<void> {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST ?? 'localhost',
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    username: requireEnv('DB_USER'),
    password: requireEnv('DB_PASSWORD'),
    database: requireEnv('DB_NAME'),
    entities: instanceEntities,
    migrations: ['dist/migrations/instance/*.js'],
    migrationsTableName: 'migrations',
    // 'each' allows individual migrations to declare `transaction = false`
    // (required for CREATE INDEX CONCURRENTLY — see migrations
    // 1930900000000-add-jsonb-gin-indexes.ts and 1931000000000-
    // add-search-acl-fields.ts). With the TypeORM default 'all', those
    // migrations are rejected at runtime. Mirrors scripts/datasource-
    // instance.ts which already sets this for the dev/CLI path.
    migrationsTransactionMode: 'each',
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
