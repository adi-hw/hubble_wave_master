import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Tenant, AuthEvent, ApiKey } from '@eam-platform/platform-db';
import { TenantDbModule } from '@eam-platform/tenant-db';
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

@Module({
  imports: [
    TypeOrmModule.forFeature([Tenant, AuthEvent, ApiKey]),
    TenantDbModule,
    PassportModule,
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
  ],
  controllers: [AuthController, PasswordPolicyController, MfaController, PasswordResetController, EmailVerificationController, ApiKeyController],
  providers: [AuthService, JwtStrategy, LdapService, RefreshTokenService, MfaService, PasswordResetService, EmailVerificationService, ApiKeyService, ApiKeyGuard, AuthEventsService],
  exports: [AuthService, MfaService, ApiKeyService, ApiKeyGuard, AuthEventsService],
})
export class AuthModule {}
