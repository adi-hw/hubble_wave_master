/**
 * Canon §29.7 — `RequestContext` is canonically defined in
 * `@hubblewave/auth-guard`. This re-export exists so app-local code
 * that historically imported from `apps/api/src/app/kernel` keeps
 * resolving without forcing a sweep just to migrate import paths.
 *
 * New code MUST import from `@hubblewave/auth-guard` directly.
 */
export {
  RequestContext,
  UserRequestContext,
  ServiceRequestContext,
  AuthenticatedUser,
  InstanceRequest,
  TenantRequest,
  AuthenticatedRequest,
  PublicRequest,
  assertUserContext,
  assertServiceContext,
  isUserContext,
  isServiceContext,
  extractContext,
} from '@hubblewave/auth-guard';
