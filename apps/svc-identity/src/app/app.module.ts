import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { UsersModule } from './users/users.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { InstanceDbModule } from '@hubblewave/instance-db';
import { AuthGuardModule } from '@hubblewave/auth-guard';
import { IdentityService } from './identity.service';
import { AuthModule } from '../../../api/src/app/identity/auth/auth.module';
import { OidcModule } from '../../../api/src/app/identity/oidc/oidc.module';
import { EmailModule } from '../../../api/src/app/identity/email/email.module';
import { JwtAuthGuard } from '../../../api/src/app/identity/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../api/src/app/identity/auth/guards/permissions.guard';
import { RolesGuard } from '../../../api/src/app/identity/auth/guards/roles.guard';
import { LoggingInterceptor } from '../../../api/src/app/identity/common/interceptors/logging.interceptor';
import { ApiKeyGuard } from '../../../api/src/app/identity/auth/api-key/api-key.guard';
import { AbacModule } from '../../../api/src/app/identity/abac/abac.module';
import { SettingsModule } from '../../../api/src/app/identity/config/config.module';
import { AbacGuard } from '../../../api/src/app/identity/abac/abac.guard';
import { UiModule } from '../../../api/src/app/identity/ui/ui.module';
import { HealthController } from './health.controller';
import { IamModule } from '../../../api/src/app/identity/iam/iam.module';
import { NavigationModule } from '../../../api/src/app/identity/navigation/navigation.module';
import { GroupsModule } from '../../../api/src/app/identity/groups/groups.module';
import { RolesModule } from '../../../api/src/app/identity/roles/roles.module';
import { AuditModule } from '../../../api/src/app/identity/audit/audit.module';
import { PoliciesModule } from '../../../api/src/app/identity/policies/policies.module';
import { CsrfMiddleware } from '../../../api/src/app/identity/auth/middleware/csrf.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ([{
        ttl: config.get<number>('RATE_LIMIT_TTL', 60000),
        limit: config.get<number>('RATE_LIMIT_MAX', 100),
      }]),
    }),
    InstanceDbModule,
    UsersModule,
    AuthModule,
    AuthGuardModule,
    OidcModule,
    EmailModule,
    AbacModule,
    SettingsModule,
    UiModule,
    IamModule,
    NavigationModule,
    GroupsModule,
    RolesModule,
    AuditModule,
    PoliciesModule,
  ],
  // PlatformController removed as its dependencies are gone
  controllers: [HealthController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ApiKeyGuard, // Check API Key first
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    // TenantGuard removed
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PermissionsGuard,
    },
    {
      provide: APP_GUARD,
      useClass: AbacGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    IdentityService,
    CsrfMiddleware,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Apply CSRF protection to all routes
    // The middleware itself handles exemptions for public endpoints
    consumer.apply(CsrfMiddleware).forRoutes('*');
  }
}
