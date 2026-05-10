import { Module } from '@nestjs/common';
import { EmailModule } from './email/email.module';
import { AuthModule } from './auth/auth.module';
import { AbacModule } from './abac/abac.module';
import { LdapModule } from './ldap/ldap.module';
import { RolesModule } from './roles/roles.module';
import { IamModule } from './iam/iam.module';
import { OidcModule } from './oidc/oidc.module';
import { PoliciesModule } from './policies/policies.module';

/**
 * IdentityModule consolidates everything from apps/svc-identity into the
 * apps/api modular monolith. Sub-modules migrate one at a time via git mv;
 * each migration registers its module here.
 *
 * Migration progress (per docs/superpowers/plans/2026-05-09-platform-w1-identity-migration.md):
 *   [x] common
 *   [ ] config
 *   [x] email
 *   [x] auth
 *   [x] abac
 *   [x] policies
 *   [ ] users
 *   [x] roles
 *   [ ] groups
 *   [x] iam
 *   [x] ldap
 *   [x] oidc
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
  imports: [EmailModule, AuthModule, AbacModule, LdapModule, RolesModule, IamModule, OidcModule, PoliciesModule],
  controllers: [],
  providers: [],
  exports: [EmailModule, AuthModule, AbacModule, LdapModule, RolesModule, IamModule, OidcModule, PoliciesModule],
})
export class IdentityModule {}
