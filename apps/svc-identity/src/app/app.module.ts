import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { UsersModule } from './users/users.module';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlatformDbModule, Tenant } from '@eam-platform/platform-db';
import { TenantDbModule } from '@eam-platform/tenant-db';
import { AuthGuardModule } from '@eam-platform/auth-guard';
// AppController removed
import { IdentityService } from './identity.service';
import { AuthModule } from './auth/auth.module';
import { OidcModule } from './oidc/oidc.module';
import { EmailModule } from './email/email.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { PermissionsGuard } from './auth/guards/permissions.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { TenantGuard } from './auth/guards/tenant.guard';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { ApiKeyGuard } from './auth/api-key/api-key.guard';
import { RbacModule } from './rbac/rbac.module';
import { AbacModule } from './abac/abac.module';
import { SettingsModule } from './config/config.module';
import { AbacGuard } from './abac/abac.guard';
import { UiModule } from './ui/ui.module';
import { TenantProvisioningService } from './platform/tenant-provisioning.service';
import { DefaultTenantBootstrapService } from './platform/default-tenant-bootstrap.service';
import { PlatformController } from './platform/platform.controller';
import { TenantResolverMiddleware } from './common/middleware/tenant-resolver.middleware';
import { HealthController } from './health.controller';
import { IamModule } from './iam/iam.module';
import { NavigationModule } from './navigation/navigation.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 100, // Increased from 10 to allow normal app usage
    }]),
    PlatformDbModule,
    UsersModule,
    TenantDbModule,
    TypeOrmModule.forFeature([Tenant]),
    AuthModule,
    AuthGuardModule,
    OidcModule,
    EmailModule,
    RbacModule,
    AbacModule,
    SettingsModule,
    UiModule,
    IamModule,
    NavigationModule,
  ],
  controllers: [PlatformController, HealthController],
  providers: [
    TenantProvisioningService,
    DefaultTenantBootstrapService,
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
    {
      provide: APP_GUARD,
      useClass: TenantGuard,
    },
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
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Use named wildcard to avoid path-to-regexp warnings in Nest v11+
    consumer.apply(TenantResolverMiddleware).forRoutes('{*path}');
  }
}
