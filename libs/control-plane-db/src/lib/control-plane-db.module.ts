import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
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
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('CONTROL_PLANE_DB_HOST', 'localhost'),
        port: configService.get('CONTROL_PLANE_DB_PORT', 5432),
        username: configService.get('CONTROL_PLANE_DB_USER', 'hubblewave'),
        password: configService.get('CONTROL_PLANE_DB_PASSWORD'),
        database: configService.get('CONTROL_PLANE_DB_NAME', 'hubblewave_control_plane'),
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
