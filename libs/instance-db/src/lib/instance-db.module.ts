import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
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
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('DB_HOST', 'localhost'),
        port: parseInt(configService.get('DB_PORT', '5432'), 10),
        username: configService.get('DB_USER', 'hubblewave'),
        password: configService.get('DB_PASSWORD', 'hubblewave'),
        database: configService.get('DB_NAME', 'hubblewave'),
        entities: instanceEntities,
        synchronize: false, // Always use migrations in production
        migrationsRun: configService.get('RUN_MIGRATIONS', 'true') === 'true',
        migrations: ['dist/migrations/instance/*.js'],
        subscribers: [AuditLogSubscriber],
        logging: configService.get('DB_LOGGING', 'false') === 'true',
        ssl: configService.get('DB_SSL', 'false') === 'true' 
          ? { rejectUnauthorized: false } 
          : false,
        // Connection pool settings
        extra: {
          max: parseInt(configService.get('DB_POOL_MAX', '20'), 10),
          idleTimeoutMillis: parseInt(configService.get('DB_POOL_IDLE_TIMEOUT', '30000'), 10),
          connectionTimeoutMillis: parseInt(configService.get('DB_CONNECTION_TIMEOUT', '5000'), 10),
        },
      }),
      inject: [ConfigService],
    }),
    TypeOrmModule.forFeature(instanceEntities),
  ],
  providers: [InstanceDbService],
  exports: [TypeOrmModule, InstanceDbService],
})
export class InstanceDbModule {}
