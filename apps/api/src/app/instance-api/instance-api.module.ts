import { Module } from '@nestjs/common';
import { IdentityModule } from './identity/identity.module';

/**
 * InstanceApiModule consolidates svc-instance-api into apps/api per spec §2.
 * svc-instance-api is an aggregator/proxy for instance-plane endpoints
 * (auth flows, pack install endpoints, instance-specific identity wrappers).
 *
 * Migration progress (per docs/superpowers/plans/2026-05-10-platform-w1-foldins-migration.md):
 *   [x] identity (instance-api's identity wrapper — distinct from apps/api/identity)
 *   [ ] packs (dto + guards used by pack install flows)
 *   [ ] instance-api-health.controller (renamed from health.controller)
 *   [ ] instance-api.module final composition
 *   [ ] svc-instance-api app.module thin adapter
 *
 * Note: the IdentityModule imported here is the instance-api's auth-flow
 * wrapper (apps/api/src/app/instance-api/identity/identity.module.ts),
 * NOT the canonical svc-identity IdentityModule at
 * apps/api/src/app/identity/identity.module.ts. Different files, different
 * scopes — no collision at this import site or at the root AppModule.
 */
@Module({
  imports: [IdentityModule],
  controllers: [],
  providers: [],
  exports: [],
})
export class InstanceApiModule {}
