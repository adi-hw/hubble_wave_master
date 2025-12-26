import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { UsersModule } from './users/users.module';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { InstanceDbModule } from '@hubblewave/instance-db';
import { AuthGuardModule } from '@hubblewave/auth-guard';
import { IdentityService } from './identity.service';
import { AuthModule } from './auth/auth.module';
import { OidcModule } from './oidc/oidc.module';
import { EmailModule } from './email/email.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { PermissionsGuard } from './auth/guards/permissions.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { ApiKeyGuard } from './auth/api-key/api-key.guard';
import { AbacModule } from './abac/abac.module';
import { SettingsModule } from './config/config.module';
import { AbacGuard } from './abac/abac.guard';
import { UiModule } from './ui/ui.module';
import { HealthController } from './health.controller';
import { IamModule } from './iam/iam.module';
import { NavigationModule } from './navigation/navigation.module';
import { GroupsModule } from './groups/groups.module';
import { RolesModule } from './roles/roles.module';
import { CsrfMiddleware } from './auth/middleware/csrf.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 100, // Increased from 10 to allow normal app usage
    }]),
    InstanceDbModule,
    UsersModule,
    // TypeOrmModule.forFeature([Tenant]),
    AuthModule,
    AuthGuardModule,
    OidcModule,
    EmailModule,
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
