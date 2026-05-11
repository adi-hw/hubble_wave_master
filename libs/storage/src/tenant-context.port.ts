/**
 * Port for resolving the active tenant identifier at storage call time
 * (F140: enforce per-customer key prefixes on every StorageClient
 * operation). Canon §5 SOFTEN: in single-tenant deployments the tenant
 * is the instance's customer code; in pooled deployments it varies per
 * request.
 *
 * libs/storage defines the port; the consuming Nest app supplies the
 * implementation via DI. Single-tenant apps can bind a fixed value;
 * pooled-mode apps bind an AsyncLocalStorage-backed resolver that reads
 * RequestContext.tenantId.
 *
 * Implementations MUST throw rather than return null/empty when the
 * tenant cannot be resolved. A missing tenant is a programming error,
 * never a degraded mode — the wrapper fails closed to keep
 * cross-tenant leakage architecturally impossible.
 */
export interface TenantContextPort {
  /**
   * Return the active tenant identifier. Throws if no tenant is in
   * scope; never returns empty or null. Implementations must validate
   * the returned value is a non-empty, reasonably bounded string and
   * is safe to embed in a storage key path segment.
   */
  resolveTenantId(): string;
}

/** Nest DI token for binding the port implementation. */
export const TENANT_CONTEXT_PORT = 'TENANT_CONTEXT_PORT';
