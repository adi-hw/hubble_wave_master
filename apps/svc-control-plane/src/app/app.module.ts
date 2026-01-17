import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { controlPlaneEntities } from '@hubblewave/control-plane-db';
import { ThrottlerGuard, ThrottlerModule, ThrottlerModuleOptions } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth';
import { CustomersModule } from './customers';
import { InstancesModule } from './instances';
import { AuditModule } from './audit';
import { TerraformModule } from './terraform';
import { MetricsModule } from './metrics';
import { LicensesModule } from './licenses/licenses.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { HealthAggregatorModule } from './health-aggregator';
import { PacksModule } from './packs';
import { RecoveryModule } from './recovery/recovery.module';
import { SettingsModule } from './settings';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AuditInterceptor } from './audit/audit.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot(),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService): ThrottlerModuleOptions => ({
        throttlers: [
          {
            ttl: config.get<number>('CONTROL_PLANE_RATE_LIMIT_TTL', 60),
            limit: config.get<number>('CONTROL_PLANE_RATE_LIMIT', 100),
          },
        ],
      }),
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const nodeEnv = configService.get('NODE_ENV') || 'development';
        const dbPassword = configService.get('CONTROL_PLANE_DB_PASSWORD');

        if (!dbPassword && nodeEnv === 'production') {
          throw new Error('CONTROL_PLANE_DB_PASSWORD must be set in production');
        }

        if (!dbPassword || dbPassword === 'password') {
          console.warn('\x1b[31m[SECURITY] WARNING: CONTROL_PLANE_DB_PASSWORD uses a development default. This is acceptable for development but MUST be changed for production.\x1b[0m');
        }

        return {
          type: 'postgres',
          host: configService.get('CONTROL_PLANE_DB_HOST', '127.0.0.1'),
          port: configService.get<number>('CONTROL_PLANE_DB_PORT', 5432),
          username: configService.get('CONTROL_PLANE_DB_USER', 'admin'),
          password: dbPassword || 'password',
          database: configService.get('CONTROL_PLANE_DB_NAME', 'hubblewave_control_plane'),
          entities: controlPlaneEntities,
          // Never allow auto-sync in production; rely on migrations instead.
          synchronize: nodeEnv !== 'production',
          ssl: configService.get('DB_SSL', 'false') === 'true'
            ? { rejectUnauthorized: false }
            : false,
          logging: nodeEnv === 'development',
        };
      },
    }),
    AuthModule,
    CustomersModule,
    InstancesModule,
    AuditModule,
    TerraformModule,
    MetricsModule,
    LicensesModule,
    SubscriptionsModule,
    HealthAggregatorModule,
    PacksModule,
    RecoveryModule,
    SettingsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
  ],
})
export class AppModule {}
