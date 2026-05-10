import { Module } from '@nestjs/common';

/**
 * InstanceApiModule consolidates svc-instance-api into apps/api per spec §2.
 * svc-instance-api is an aggregator/proxy for instance-plane endpoints
 * (auth flows, pack install endpoints, instance-specific identity wrappers).
 *
 * Migration progress (per docs/superpowers/plans/2026-05-10-platform-w1-foldins-migration.md):
 *   [ ] identity (instance-api's identity wrapper — distinct from apps/api/identity)
 *   [ ] packs (dto + guards used by pack install flows)
 *   [ ] instance-api-health.controller (renamed from health.controller)
 *   [ ] instance-api.module final composition
 *   [ ] svc-instance-api app.module thin adapter
 *
 * Note: this module's internal identity sub-module exports a class also
 * called `IdentityModule` — distinct from apps/api/src/app/identity/identity.module.ts
 * (svc-identity's canonical IdentityModule). Different files, different scopes.
 */
@Module({
  imports: [],
  controllers: [],
  providers: [],
  exports: [],
})
export class InstanceApiModule {}
