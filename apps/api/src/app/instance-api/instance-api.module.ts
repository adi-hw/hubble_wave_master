/**
 * InstanceApiModule — instance-plane auth-flow surface and pack install
 * token guard.
 *
 * The previously-existing parallel HS256 auth path is deleted as part of
 * Plan Fix 29 (canon §29.9 — HS256 forbidden everywhere). IdentityModule
 * here is the thin alias module that re-exposes canonical auth endpoints
 * at `identity/auth/*` using the canonical ES256 TokenIssuerService.
 */
import { Module } from '@nestjs/common';
import { IdentityModule } from './identity/identity.module';
import { InstanceApiHealthController } from './instance-api-health.controller';

@Module({
  imports: [IdentityModule],
  controllers: [InstanceApiHealthController],
  exports: [],
})
export class InstanceApiModule {}
