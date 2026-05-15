import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { instanceEntities } from './entities/index';
import { AuditLogSubscriber } from './subscribers/audit-log.subscriber';
import { IdentityCacheInvalidationSubscriber } from './subscribers/identity-cache-invalidation.subscriber';
import { AccessRuleCacheInvalidationSubscriber } from './subscribers/access-rule-cache-invalidation.subscriber';
import { InstanceDbService } from './instance-db.service';
import { AvaProposalService } from './ava-proposal/ava-proposal.service';

/**
 * Instance Database Module
 *
 * Provides access to the Customer Instance database.
 * Each customer has their own completely isolated database.
 *
 * Architecture:
 * - There is NO dynamic database switching
 * - There is NO instance_id column in business tables
 * - Just standard TypeORM with a single database connection per customer instance
 *
 * Configuration is via environment variables:
 * - DB_HOST: Database host (default: localhost)
 * - DB_PORT: Database port (default: 5432)
 * - DB_USER: Database user (default: hubblewave)
 * - DB_PASSWORD: Database password
 * - DB_NAME: Database name (default: hubblewave)
 * - DB_SSL: Enable SSL (default: false)
 * - DB_LOGGING: Enable query logging (default: false)
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService): TypeOrmModuleOptions => {
        const nodeEnv = configService.get<string>('NODE_ENV', 'development');
        const dbPassword = configService.get<string>('DB_PASSWORD');
        if (!dbPassword) {
          throw new Error(
            'DB_PASSWORD is required. Set it in your environment or .env file before starting an instance service.',
          );
        }

        // SSL posture (canon §10 — Compliance by Default).
        // In production rejectUnauthorized is always true; the previous
        // hardcoded `false` made TLS cosmetic and left the connection
        // open to MITM. Outside production the operator may opt out for
        // self-signed local certs via DB_SSL_REJECT_UNAUTHORIZED=false;
        // production ignores the flag and always verifies.
        let ssl: false | { rejectUnauthorized: boolean; ca?: string } = false;
        if (configService.get('DB_SSL', 'false') === 'true') {
          const caPem = configService.get<string>('DB_SSL_CA');
          let rejectUnauthorized = true;
          if (nodeEnv !== 'production') {
            const opted = configService.get<string>('DB_SSL_REJECT_UNAUTHORIZED');
            if (opted === 'false') {
              rejectUnauthorized = false;
              console.warn(
                '\x1b[33m[SECURITY] DB_SSL_REJECT_UNAUTHORIZED=false honored ' +
                  '(non-production only). The Postgres driver will accept any ' +
                  'TLS certificate. Use only for local self-signed dev DBs.\x1b[0m',
              );
            }
          }
          ssl = caPem
            ? { rejectUnauthorized, ca: caPem }
            : { rejectUnauthorized };
        }

        // W6.C (F045): PgBouncer sits in front of Postgres in transaction-pooling
        // mode. The runtime DataSource connects to PgBouncer (DB_HOST:DB_PORT).
        // When the migration runner needs a direct Postgres connection it reads
        // DIRECT_DB_HOST / DIRECT_DB_PORT instead; the same pattern applies to
        // any consumer using LISTEN/NOTIFY (which PgBouncer transaction mode
        // does not support).
        //
        // In development (no PgBouncer) DB_HOST / DB_PORT resolve directly to
        // Postgres and the DIRECT_* vars are optional (they fall back to the
        // same values).
        const migrationsRun = configService.get('RUN_MIGRATIONS', 'false') === 'true';
        const dbHost = migrationsRun
          ? configService.get<string>('DIRECT_DB_HOST', configService.get<string>('DB_HOST', 'localhost'))
          : configService.get<string>('DB_HOST', 'localhost');
        const dbPort = migrationsRun
          ? parseInt(configService.get<string>('DIRECT_DB_PORT', configService.get<string>('DB_PORT', '5432')), 10)
          : parseInt(configService.get<string>('DB_PORT', '5432'), 10);

        return {
          type: 'postgres' as const,
          host: dbHost,
          port: dbPort,
          username: configService.get<string>('DB_USER', 'hubblewave'),
          password: dbPassword,
          database: configService.get<string>('DB_NAME', 'hubblewave'),
          entities: instanceEntities,
          synchronize: false,
          // W1.3: migrations now run from the dedicated svc-migrations job
          // with pg_advisory_lock; app pods boot read-only by default.
          // W6.C: migration runner uses DIRECT_DB_HOST/DIRECT_DB_PORT (above)
          // so DDL statements bypass PgBouncer transaction-pooling mode.
          //
          // The glob `dist/migrations/instance/*.js` is only loaded when
          // `RUN_MIGRATIONS=true`. App pods (apps/api, apps/worker) boot
          // with `migrationsRun=false` and don't need to register any
          // migrations with TypeORM — registering them would still trigger
          // `require()` of the compiled migration files, and the one that
          // imports `@hubblewave/instance-db` cannot resolve that package
          // at pure-Node runtime because TypeScript path mapping is a
          // compile-time concept. The conditional below keeps app pods
          // immune to that path entirely; only the svc-migrations Job
          // (RUN_MIGRATIONS=true) loads the compiled migrations.
          migrationsRun,
          migrations: migrationsRun ? ['dist/migrations/instance/*.js'] : [],
          // W1.7: IdentityCacheInvalidationSubscriber publishes identity.*
          // events on UserRole/RolePermission/GroupRole/GroupMember changes
          // so permission caches invalidate immediately (~1s end-to-end).
          // F025: AccessRuleCacheInvalidationSubscriber publishes
          // collection/property-rule invalidations to AuthorizationService
          // (port-bound) so the 5-min in-memory rule cache reflects
          // CollectionAccessRule / PropertyAccessRule writes within one
          // post-commit dispatch.
          subscribers: [
            AuditLogSubscriber,
            IdentityCacheInvalidationSubscriber,
            AccessRuleCacheInvalidationSubscriber,
          ],
          logging: configService.get('DB_LOGGING', 'false') === 'true',
          ssl,
          extra: {
            // W6.C: with PgBouncer in transaction mode, the Node process needs
            // far fewer pg-driver-level connections. PgBouncer multiplexes
            // these 10 driver connections into up to default_pool_size (25)
            // Postgres backends. DB_POOL_MAX can be overridden per-instance
            // for tuning, but should remain well below PgBouncer's
            // max_client_conn to avoid saturating the pool.
            max: parseInt(configService.get('DB_POOL_MAX', '10'), 10),
            idleTimeoutMillis: parseInt(configService.get('DB_POOL_IDLE_TIMEOUT', '30000'), 10),
            connectionTimeoutMillis: parseInt(configService.get('DB_CONNECTION_TIMEOUT', '5000'), 10),
            // W6.C: disable pg driver-level prepared statement caching.
            // PgBouncer transaction mode does not persist a server connection
            // across statements, so prepared statements from one transaction
            // are not visible in the next. Sending PREPARE against a pooled
            // connection would fail with "prepared statement does not exist".
            statement_timeout: parseInt(configService.get('DB_STATEMENT_TIMEOUT', '30000'), 10),
            options: '-c statement_timeout=30000',
          },
          // W6.C: instruct the underlying pg driver not to use prepared
          // statements. Without this flag, node-postgres caches PREPARE
          // responses on the client side and sends prepared-statement
          // execution on subsequent calls — which breaks under PgBouncer
          // transaction mode because the server connection may change.
          cache: false,
        };
      },
      inject: [ConfigService],
    }),
    TypeOrmModule.forFeature(instanceEntities),
  ],
  providers: [
    InstanceDbService,
    AvaProposalService,
    // Allow consumers (e.g. RequireApprovedProposalGuard) to inject by token,
    // mirroring the existing 'AuditService' / interface-based wiring patterns
    // used elsewhere in the platform.
    { provide: 'AvaProposalService', useExisting: AvaProposalService },
  ],
  exports: [
    TypeOrmModule,
    InstanceDbService,
    AvaProposalService,
    'AvaProposalService',
  ],
})
export class InstanceDbModule {}
