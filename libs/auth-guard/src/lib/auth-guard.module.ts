import { Global, Module, Logger } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from './jwt.guard';
import { RolesGuard } from './roles.guard';
import { PermissionsGuard } from './permissions.guard';

/**
 * Global wiring for the canon §29 authentication guard stack.
 *
 * `JwtAuthGuard` (post-PR-B) verifies ES256 tokens via the application's
 * `KEY_SIGNING_SERVICE` binding — the JwtModule below is retained only
 * for transitional consumers that still import `@nestjs/jwt` types. No
 * code path verifies HS256 tokens.
 *
 * Apps importing this module MUST also bind `KEY_SIGNING_SERVICE` (via
 * the apps/api KeySigningModule, which is itself `@Global`). Failure to
 * bind it causes a startup-time DI error rather than a silent token
 * acceptance, which is the desired posture.
 */
@Global()
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const logger = new Logger('AuthGuardModule');
        const jwtSecret =
          configService.get<string>('JWT_SECRET') ||
          configService.get<string>('IDENTITY_JWT_SECRET');
        if (jwtSecret) {
          logger.warn(
            'JWT_SECRET (or IDENTITY_JWT_SECRET) is set but unused — ' +
              'token verification migrated to ES256/JWKS per canon §29 ' +
              'PR-B. The variable is accepted to avoid breaking dev ' +
              'environments; remove it after the cutover.',
          );
        }
        // Placeholder secret — JwtModule construction must not throw.
        // No code path uses it for verification post-PR-B.
        return { secret: jwtSecret || 'unused-post-canon-§29-pr-b' };
      },
      inject: [ConfigService],
    }),
  ],
  providers: [
    JwtAuthGuard,
    RolesGuard,
    PermissionsGuard,
    {
      provide: Logger,
      useValue: new Logger('JwtAuthGuard'),
    },
  ],
  exports: [JwtAuthGuard, RolesGuard, PermissionsGuard, JwtModule, Logger],
})
export class AuthGuardModule {}
