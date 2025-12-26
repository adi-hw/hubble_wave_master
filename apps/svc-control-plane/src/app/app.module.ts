import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ControlPlaneEntities } from '@hubblewave/control-plane-db';
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
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AuditInterceptor } from './audit/audit.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
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

        return {
          type: 'postgres',
          host: configService.get('CONTROL_PLANE_DB_HOST', 'localhost'),
          port: configService.get<number>('CONTROL_PLANE_DB_PORT', 5432),
          username: configService.get('CONTROL_PLANE_DB_USER', 'admin'),
          password: configService.get('CONTROL_PLANE_DB_PASSWORD', 'password'),
          database: configService.get('CONTROL_PLANE_DB_NAME', 'eam_control'),
          entities: ControlPlaneEntities,
          // Never allow auto-sync in production; rely on migrations instead.
          synchronize: nodeEnv !== 'production',
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
