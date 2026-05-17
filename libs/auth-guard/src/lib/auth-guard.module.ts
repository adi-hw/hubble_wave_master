import { Global, Module, Logger } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtAuthGuard } from './jwt.guard';
import { RolesGuard } from './roles.guard';
import { PermissionsGuard } from './permissions.guard';

/**
 * Global wiring for the canon §29 authentication guard stack.
 *
 * `JwtAuthGuard` verifies ES256 tokens via the application's
 * `KEY_SIGNING_SERVICE` binding (canon §29.1 + §29.9). No code path
 * verifies HS256 tokens — the prior transitional `JwtModule.registerAsync`
 * block was deleted by W2 Stream 1 PR4 along with the unused
 * `JWT_SECRET` env var.
 *
 * Apps importing this module MUST also bind `KEY_SIGNING_SERVICE` (via
 * the apps/api `KeySigningModule` or the apps/control-plane
 * `ControlPlaneKeySigningModule`, both of which are `@Global`). Failure
 * to bind it causes a startup-time DI error rather than silent token
 * acceptance — the desired posture per canon §9.
 */
@Global()
@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  providers: [
    JwtAuthGuard,
    RolesGuard,
    PermissionsGuard,
    {
      provide: Logger,
      useValue: new Logger('JwtAuthGuard'),
    },
  ],
  exports: [JwtAuthGuard, RolesGuard, PermissionsGuard, Logger],
})
export class AuthGuardModule {}
