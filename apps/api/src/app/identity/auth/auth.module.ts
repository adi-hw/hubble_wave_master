import { Logger, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import {
  IDENTITY_RESOLVER_PORT,
  JWT_REVOCATION_PORT,
} from '@hubblewave/auth-guard';
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
  InstanceDbModule,
  // Advanced Authentication entities
  WebAuthnCredential,
  WebAuthnChallenge,
  MagicLinkToken,
  TrustedDevice,
  ImpersonationSession,
  Delegation,
  BehavioralProfile,
  SecurityAlert,
  AuditLog,
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
// Advanced Authentication services
import { WebAuthnService } from './webauthn.service';
import { WebAuthnController } from './webauthn.controller';
import { MagicLinkService } from './magic-link.service';
import { MagicLinkController } from './magic-link.controller';
import { ImpersonationService } from './impersonation.service';
import { ImpersonationController } from './impersonation.controller';
import { DelegationService } from './delegation.service';
import { DelegationController } from './delegation.controller';
import { DeviceTrustService } from './device-trust.service';
import { DeviceTrustController } from './device-trust.controller';
import { BehavioralAnalyticsService } from './behavioral-analytics.service';
import { BehavioralAnalyticsController } from './behavioral-analytics.controller';
import { IdentityResolverAdapter } from './identity-resolver.adapter';
import { JwtRevocationAdapter } from './jwt-revocation.adapter';
import { KeySigningModule } from './key-signing/key-signing.module';
import { JwksController } from './jwks.controller';
import { TokenIssuerService } from './token-issuer.service';

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
      // Advanced Authentication entities
      WebAuthnCredential,
      WebAuthnChallenge,
      MagicLinkToken,
      TrustedDevice,
      ImpersonationSession,
      Delegation,
      BehavioralProfile,
      SecurityAlert,
      AuditLog,
    ]),
    InstanceDbModule,
    RolesModule,
    PassportModule,
    RedisModule.forRoot(),
    // JwtModule remains registered for transitional reasons — passport
    // and other downstream code that depends on `@nestjs/jwt` types still
    // resolve through this module. Per canon §29 PR-B the platform no
    // longer uses HS256 signing or JwtService.sign(); every token is
    // minted via TokenIssuerService (ES256, KMS-backed). The legacy
    // JWT_SECRET env var is accepted but unused — a warning is logged at
    // startup so operators can clean it up. PR-D drops the JwtModule
    // dependency entirely once no consumer still pulls JwtService.
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const logger = new Logger('AuthModule');
        const jwtSecret = configService.get<string>('JWT_SECRET');
        if (jwtSecret) {
          logger.warn(
            'JWT_SECRET is set but unused — token signing migrated to ' +
              'KMS-backed ES256 per canon §29 PR-A. Remove JWT_SECRET ' +
              'once you have confirmed no client still relies on HS256 ' +
              'tokens.',
          );
        }
        // Provide a placeholder secret so JwtModule construction does
        // not throw. The secret is not used by any code path post-§29
        // PR-B; if it were, jwtVerify with the KMS public key would
        // reject the token before this secret was even consulted.
        return {
          secret: jwtSecret || 'unused-post-canon-§29-pr-b',
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
    // canon §29 PR-A: signing-key infrastructure + JWKS publication.
    KeySigningModule.forRoot(),
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
    // Advanced Authentication controllers
    WebAuthnController,
    MagicLinkController,
    ImpersonationController,
    DelegationController,
    DeviceTrustController,
    BehavioralAnalyticsController,
    // canon §29 PR-A
    JwksController,
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
    // Advanced Authentication services
    WebAuthnService,
    MagicLinkService,
    ImpersonationService,
    DelegationService,
    DeviceTrustService,
    BehavioralAnalyticsService,
    // Email service provider for Magic Link
    {
      provide: 'EMAIL_SERVICE',
      useFactory: () => {
        const logger = new Logger('EmailService');
        return {
          sendMagicLink: async (email: string, link: string, expiresAt: Date) => {
            // In production, this would use a real email service
            logger.debug(`[DEV] Magic link for ${email}: ${link} (expires: ${expiresAt.toISOString()})`);
          },
        };
      },
    },
    // F013: bind JwtAuthGuard's IdentityResolverPort to the DB-backed
    // adapter. Without this, the guard would fall back to JWT-embedded
    // roles/permissions which can be stale by up to the access-token TTL.
    IdentityResolverAdapter,
    { provide: IDENTITY_RESOLVER_PORT, useExisting: IdentityResolverAdapter },
    // F002: bind JwtAuthGuard's JwtRevocationPort to the Redis-backed
    // adapter. The logout endpoint and admin "log me out everywhere"
    // flows write to it; the guard checks it on every authenticated
    // request to short-circuit revoked access tokens before their exp.
    JwtRevocationAdapter,
    { provide: JWT_REVOCATION_PORT, useExisting: JwtRevocationAdapter },
    // canon §29 PR-B: single mint point for HubbleWave access tokens.
    // Wraps KeySigningService (ES256) and embeds canon §29.3 claims
    // including the per-user security_stamp → token_version kill-switch.
    TokenIssuerService,
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
    // Advanced Authentication services
    WebAuthnService,
    MagicLinkService,
    ImpersonationService,
    DelegationService,
    DeviceTrustService,
    BehavioralAnalyticsService,
    // Re-export the adapters + DI tokens so global guards bound at the
    // IdentityModule level can resolve them.
    IdentityResolverAdapter,
    JwtRevocationAdapter,
    IDENTITY_RESOLVER_PORT,
    JWT_REVOCATION_PORT,
    // Export TokenIssuerService so SSO callbacks + the instance-api
    // legacy duplicate (which lives in a sibling module) can mint
    // tokens through the same canon §29.3 contract.
    TokenIssuerService,
  ],
})
export class AuthModule {}
