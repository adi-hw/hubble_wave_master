import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { instanceEntities } from './entities/index';
import { AuditLogSubscriber } from './subscribers/audit-log.subscriber';
import { InstanceDbService } from './instance-db.service';

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

        return {
          type: 'postgres' as const,
          host: configService.get<string>('DB_HOST', 'localhost'),
          port: parseInt(configService.get<string>('DB_PORT', '5432'), 10),
          username: configService.get<string>('DB_USER', 'hubblewave'),
          password: dbPassword,
          database: configService.get<string>('DB_NAME', 'hubblewave'),
          entities: instanceEntities,
          synchronize: false, // Always use migrations in production
          // W1.3: migrations now run from the dedicated svc-migrations job
          // with pg_advisory_lock; app pods boot read-only by default.
          migrationsRun: configService.get('RUN_MIGRATIONS', 'false') === 'true',
          migrations: ['dist/migrations/instance/*.js'],
          subscribers: [AuditLogSubscriber],
          logging: configService.get('DB_LOGGING', 'false') === 'true',
          ssl,
          // Connection pool settings
          extra: {
            max: parseInt(configService.get('DB_POOL_MAX', '20'), 10),
            idleTimeoutMillis: parseInt(configService.get('DB_POOL_IDLE_TIMEOUT', '30000'), 10),
            connectionTimeoutMillis: parseInt(configService.get('DB_CONNECTION_TIMEOUT', '5000'), 10),
          },
        };
      },
      inject: [ConfigService],
    }),
    TypeOrmModule.forFeature(instanceEntities),
  ],
  providers: [InstanceDbService],
  exports: [TypeOrmModule, InstanceDbService],
})
export class InstanceDbModule {}
