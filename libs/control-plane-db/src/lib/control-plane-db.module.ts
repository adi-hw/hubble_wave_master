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

        return {
          type: 'postgres' as const,
          host: configService.get<string>('CONTROL_PLANE_DB_HOST', 'localhost'),
          port: configService.get<number>('CONTROL_PLANE_DB_PORT', 5432),
          username: configService.get<string>('CONTROL_PLANE_DB_USER', 'hubblewave'),
          password: dbPassword,
          database: configService.get<string>('CONTROL_PLANE_DB_NAME', 'hubblewave_control_plane'),
          entities: controlPlaneEntities,
          synchronize: false, // Always use migrations in production
          migrationsRun: configService.get('RUN_CONTROL_PLANE_MIGRATIONS', 'true') === 'true',
          migrations: ['dist/migrations/control-plane/*.js'],
          logging: configService.get('DB_LOGGING', 'false') === 'true',
          ssl,
        };
      },
      inject: [ConfigService],
    }),
    TypeOrmModule.forFeature(controlPlaneEntities, 'control-plane'),
  ],
  exports: [TypeOrmModule],
})
export class ControlPlaneDbModule {}
