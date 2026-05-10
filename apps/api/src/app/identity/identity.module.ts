import { Module } from '@nestjs/common';
import { EmailModule } from './email/email.module';

/**
 * IdentityModule consolidates everything from apps/svc-identity into the
 * apps/api modular monolith. Sub-modules migrate one at a time via git mv;
 * each migration registers its module here.
 *
 * Migration progress (per docs/superpowers/plans/2026-05-09-platform-w1-identity-migration.md):
 *   [x] common
 *   [ ] config
 *   [x] email
 *   [ ] auth
 *   [ ] abac
 *   [ ] policies
 *   [ ] users
 *   [ ] roles
 *   [ ] groups
 *   [ ] iam
 *   [ ] ldap
 *   [ ] oidc
 *   [ ] navigation
 *   [ ] ui
 *   [ ] audit
 *   [ ] top-level (health controller + IdentityService + global guards/middleware)
 *
 * IdentityModule re-exports each migrated sub-module so that:
 * - apps/api consumers (data, automation, etc.) can inject identity services
 *   like UsersService, RolesService, AuthService without explicit sub-module imports
 * - apps/svc-identity's thin adapter (post-migration) can import IdentityModule
 *   wholesale to keep the legacy service serving the same endpoints
 */
@Module({
  imports: [EmailModule],
  controllers: [],
  providers: [],
  exports: [EmailModule],
})
export class IdentityModule {}
