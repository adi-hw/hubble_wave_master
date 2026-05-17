/**
 * Port for resolving a collection's stable customer-facing `code` to
 * its UUID `id`. The `@hubblewave/authorization` library evaluates
 * §28 access rules keyed on `collectionId` UUIDs; controllers that
 * accept a `code` in the URL need this resolver to bridge.
 *
 * Bound in apps/api by `MetadataModule` (concrete adapter wraps the
 * collection-definition repository). Apps that don't need the
 * `kind: 'code'` decorator branch (e.g. control-plane) can leave the
 * port unbound — the guard fails closed with a clear error when a
 * `kind: 'code'` decorator fires without a bound resolver.
 *
 * The interface is intentionally small. There is no `resolveById`
 * — IDs are already valid handles into the authz layer, no
 * resolution needed.
 */
export interface CollectionIdResolverPort {
  /**
   * Resolve `code` → UUID. Returns `null` if no collection with that
   * code exists in the current tenant (the guard treats `null` as a
   * `NotFoundException`, NOT a `ForbiddenException` — the resource
   * genuinely doesn't exist).
   *
   * Implementations MUST scope by the caller's tenant
   * (`UserRequestContext.attributes?.tenantId` per canon §5 SOFTEN).
   * A leak across tenants here would defeat §28 entirely.
   */
  resolveByCode(code: string): Promise<string | null>;
}

/** Injection token for `CollectionIdResolverPort`. */
export const COLLECTION_ID_RESOLVER_PORT = 'COLLECTION_ID_RESOLVER_PORT';
