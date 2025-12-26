import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { controlPlaneEntities } from './entities/index';

/**
 * Control Plane Database Module
 * 
 * Provides access to the Control Plane database (eam_control) which
 * is used by HubbleWave internally to manage customer organizations,
 * instances, subscriptions, and staff users.
 * 
 * This is NOT the customer instance database - each customer has their
 * own completely isolated database managed by the Instance DB module.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      name: 'control-plane', // Named connection for control plane
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('CONTROL_PLANE_DB_HOST', 'localhost'),
        port: configService.get('CONTROL_PLANE_DB_PORT', 5432),
        username: configService.get('CONTROL_PLANE_DB_USER', 'hubblewave'),
        password: configService.get('CONTROL_PLANE_DB_PASSWORD'),
        database: configService.get('CONTROL_PLANE_DB_NAME', 'eam_control'),
        entities: controlPlaneEntities,
        synchronize: false, // Always use migrations in production
        migrationsRun: configService.get('RUN_CONTROL_PLANE_MIGRATIONS', 'true') === 'true',
        migrations: ['dist/migrations/control-plane/*.js'],
        logging: configService.get('DB_LOGGING', 'false') === 'true',
        ssl: configService.get('DB_SSL', 'false') === 'true' ? { rejectUnauthorized: false } : false,
      }),
      inject: [ConfigService],
    }),
    TypeOrmModule.forFeature(controlPlaneEntities, 'control-plane'),
  ],
  exports: [TypeOrmModule],
})
export class ControlPlaneDbModule {}
