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

        // SSL posture (canon §10 — Compliance by Default).
        //
        // When DB_SSL=true we connect over TLS. In production the
        // certificate chain MUST be verified (rejectUnauthorized: true)
        // — the previous `false` hardcode silently accepted any
        // self-signed or attacker-presented cert and made the TLS
        // wrapper cosmetic, leaving the connection open to MITM.
        //
        // Outside production the operator may need to opt out for
        // self-signed local certs; that opt-out is explicit
        // (DB_SSL_REJECT_UNAUTHORIZED=false) and audible (the warning
        // below). Production ignores the flag.
        //
        // DB_SSL_CA, when set, supplies the PEM bundle for verification
        // (typical RDS / Cloud SQL deployment). Without it the system
        // cert store is used.
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
                  '(non-production only). The Postgres driver will accept ' +
                  'any TLS certificate. Set this only when connecting to a ' +
                  'self-signed local development database.\x1b[0m',
              );
            }
          }
          ssl = caPem
            ? { rejectUnauthorized, ca: caPem }
            : { rejectUnauthorized };
        }

        // No literal-string password fallback. dbPassword is required;
        // the production-path throw above is the gate, and dev hits a
        // clear connection error rather than silently authenticating
        // with the literal 'password'.
        if (!dbPassword) {
          throw new Error(
            'CONTROL_PLANE_DB_PASSWORD is required. ' +
              'Set it in your environment or .env file before starting svc-control-plane.',
          );
        }

        return {
          type: 'postgres',
          host: configService.get('CONTROL_PLANE_DB_HOST', '127.0.0.1'),
          port: configService.get<number>('CONTROL_PLANE_DB_PORT', 5432),
          username: configService.get('CONTROL_PLANE_DB_USER', 'admin'),
          password: dbPassword,
          database: configService.get('CONTROL_PLANE_DB_NAME', 'hubblewave_control_plane'),
          entities: controlPlaneEntities,
          // Never allow auto-sync in production; rely on migrations instead.
          synchronize: nodeEnv !== 'production',
          ssl,
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
