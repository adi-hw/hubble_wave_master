import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import {
  AuthEvent,
  ApiKey,
  UserSession,
  AuthSettings,
  SsoProvider,
  PasswordPolicy,
  User,
  UserRole,
  GroupRole,
  GroupMember,
  Role,
  PasswordHistory,
  RefreshToken,
  MfaMethod,
  EmailVerificationToken,
  PasswordResetToken,
  InstanceDbModule
} from '@hubblewave/instance-db';
import { RedisModule } from '@hubblewave/redis';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { LdapService } from '../ldap/ldap.service';
import { LdapModule } from '../ldap/ldap.module';

import { PasswordPolicyController } from './password-policy.controller';
import { RefreshTokenService } from './refresh-token.service';
import { MfaService } from './mfa.service';
import { MfaController } from './mfa.controller';
import { PasswordResetService } from './password-reset.service';
import { PasswordResetController } from './password-reset.controller';
import { EmailVerificationService } from './email-verification.service';
import { EmailVerificationController } from './email-verification.controller';
import { ApiKeyService } from './api-key/api-key.service';
import { ApiKeyController } from './api-key/api-key.controller';
import { ApiKeyGuard } from './api-key/api-key.guard';
import { EmailModule } from '../email/email.module';
import { AuthEventsService } from './auth-events.service';
import { SessionService } from './session.service';
import { SessionController } from './session.controller';
import { PasswordValidationService } from './password-validation.service';
import { SessionCacheService } from './session-cache.service';
import { SamlService } from './sso/saml.service';
import { OidcService } from './sso/oidc.service';
import { SsoController } from './sso/sso.controller';
import { RolesModule } from '../roles/roles.module';
import { GeolocationService } from './geolocation.service';
import { HttpModule } from '@nestjs/axios';
import { ScheduledTasksService } from './scheduled-tasks.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AuthEvent,
      ApiKey,
      UserSession,
      AuthSettings,
      SsoProvider,
      PasswordPolicy,
      User,
      UserRole,
      GroupRole,
      GroupMember,
      Role,
      PasswordHistory,
      RefreshToken,
      MfaMethod,
      EmailVerificationToken,
      PasswordResetToken,
    ]),
    InstanceDbModule,
    RolesModule,
    PassportModule,
    RedisModule.forRoot(),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const jwtSecret = configService.get<string>('JWT_SECRET');

        if (!jwtSecret) {
          throw new Error(
            'JWT_SECRET environment variable must be set. ' +
            'Generate a secure secret with: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"'
          );
        }

        return {
          secret: jwtSecret,
          signOptions: { expiresIn: '15m' },
        };
      },
      inject: [ConfigService],
    }),
    LdapModule,
    EmailModule,
    HttpModule.register({
      timeout: 5000,
      maxRedirects: 5,
    }),
  ],
  controllers: [
    AuthController,
    PasswordPolicyController,
    MfaController,
    PasswordResetController,
    ApiKeyController,
    SessionController,
    SsoController,
    EmailVerificationController,
  ],
  providers: [
    AuthService,
    JwtStrategy,
    LdapService,
    RefreshTokenService,
    MfaService,
    PasswordResetService,
    EmailVerificationService,
    ApiKeyService,
    ApiKeyGuard,
    AuthEventsService,
    SessionService,
    SessionCacheService,
    PasswordValidationService,
    SamlService,
    OidcService,
    GeolocationService,
    ScheduledTasksService,
  ],
  exports: [
    AuthService,
    MfaService,
    ApiKeyService,
    ApiKeyGuard,
    AuthEventsService,
    SessionService,
    SessionCacheService,
    PasswordValidationService,
    SamlService,
    OidcService,
    GeolocationService,
  ],
})
export class AuthModule {}
