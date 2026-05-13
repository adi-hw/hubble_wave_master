import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { controlPlaneEntities } from './entities/index';

/**
 * Control Plane Database Module
 *
 * Keeps control-plane state isolated from customer instance data to enforce
 * customer boundaries and governance rules.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      name: 'control-plane', // Named connection for control plane
      imports: [ConfigModule],
      useFactory: (configService: ConfigService): TypeOrmModuleOptions => {
        const nodeEnv = configService.get<string>('NODE_ENV', 'development');
        const dbPassword = configService.get<string>('CONTROL_PLANE_DB_PASSWORD');
        if (!dbPassword) {
          throw new Error(
            'CONTROL_PLANE_DB_PASSWORD is required. Set it in your environment or .env file before starting any service that opens the control-plane connection.',
          );
        }

        // SSL posture (canon §10 — Compliance by Default).
        // Production enforces certificate verification; the previous
        // hardcoded `rejectUnauthorized: false` left the connection
        // vulnerable to MITM. Non-production may opt out via
        // DB_SSL_REJECT_UNAUTHORIZED=false for self-signed local DBs.
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
                  '(non-production only). Use only for local self-signed dev DBs.\x1b[0m',
              );
            }
          }
          ssl = caPem
            ? { rejectUnauthorized, ca: caPem }
            : { rejectUnauthorized };
        }

        // W6.C (F045): Mirror the instance-plane pattern. When RUN_CONTROL_PLANE_MIGRATIONS
        // is true the DataSource must bypass any future connection pooler (PgBouncer) and
        // connect directly to Postgres because multi-statement DDL migrations are
        // incompatible with transaction-pooling mode.
        // DIRECT_CONTROL_PLANE_DB_HOST / DIRECT_CONTROL_PLANE_DB_PORT fall back to the
        // standard CONTROL_PLANE_DB_HOST/PORT values so dev environments without a
        // PgBouncer sidecar are unaffected.
        const migrationsRun = configService.get('RUN_CONTROL_PLANE_MIGRATIONS', 'true') === 'true';
        const dbHost = migrationsRun
          ? configService.get<string>(
              'DIRECT_CONTROL_PLANE_DB_HOST',
              configService.get<string>('CONTROL_PLANE_DB_HOST', 'localhost'),
            )
          : configService.get<string>('CONTROL_PLANE_DB_HOST', 'localhost');
        const dbPort = migrationsRun
          ? parseInt(
              configService.get<string>(
                'DIRECT_CONTROL_PLANE_DB_PORT',
                configService.get<string>('CONTROL_PLANE_DB_PORT', '5432'),
              ),
              10,
            )
          : configService.get<number>('CONTROL_PLANE_DB_PORT', 5432);

        return {
          type: 'postgres' as const,
          host: dbHost,
          port: dbPort,
          username: configService.get<string>('CONTROL_PLANE_DB_USER', 'hubblewave'),
          password: dbPassword,
          database: configService.get<string>('CONTROL_PLANE_DB_NAME', 'hubblewave_control_plane'),
          entities: controlPlaneEntities,
          synchronize: false,
          migrationsRun,
          migrations: ['dist/migrations/control-plane/*.js'],
          logging: configService.get('DB_LOGGING', 'false') === 'true',
          ssl,
          extra: {
            // W6.C: conservative pool size for the control-plane; connection count
            // is low (HubbleWave-internal service, not customer traffic). If a
            // PgBouncer sidecar is added to the control-plane deployment in future,
            // lowering this further and disabling prepared statements here is the
            // necessary follow-up — documented in docs/plan-fixes/26-performance-wave.md.
            max: parseInt(configService.get('CONTROL_PLANE_DB_POOL_MAX', '10'), 10),
            idleTimeoutMillis: parseInt(configService.get('CONTROL_PLANE_DB_POOL_IDLE_TIMEOUT', '30000'), 10),
            connectionTimeoutMillis: parseInt(configService.get('CONTROL_PLANE_DB_CONNECTION_TIMEOUT', '5000'), 10),
            statement_timeout: parseInt(configService.get('CONTROL_PLANE_DB_STATEMENT_TIMEOUT', '30000'), 10),
          },
          cache: false,
        };
      },
      inject: [ConfigService],
    }),
    TypeOrmModule.forFeature(controlPlaneEntities, 'control-plane'),
  ],
  exports: [TypeOrmModule],
})
export class ControlPlaneDbModule {}
