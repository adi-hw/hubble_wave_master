import {
  DeleteObjectParams,
  GetObjectParams,
  ListObjectsParams,
  PutObjectParams,
  SignedUrlParams,
  StorageClient,
} from './storage.client';
import { TenantContextPort } from './tenant-context.port';

/**
 * Storage key path segment that prefixes every tenant-scoped object.
 * Kept as an exported constant so test fixtures and audit/recovery
 * tooling can reuse it without literal duplication.
 */
export const TENANT_KEY_PREFIX_SEGMENT = 'tenants';

/**
 * Tenant identifier shape allowed inside a storage key. Canon §5 SOFTEN
 * stores either an instance customer code (single-tenant) or a UUID-ish
 * tenant id (pooled). Both fit comfortably inside this character class.
 * The pattern intentionally rejects path separators, `..`, whitespace,
 * and anything that could be interpreted as bucket / scheme delimiters.
 */
const TENANT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._\-:]{0,127}$/;

/**
 * Resolves the tenant identifier supplied at construction time. Accepts
 * either a fixed string (single-tenant deployments) or a function that
 * yields the tenant per request (pooled-mode deployments via an
 * AsyncLocalStorage- or CLS-backed resolver).
 */
export type TenantIdResolver = string | TenantContextPort | (() => string);

/**
 * F140: prefix-enforcing wrapper around any StorageClient implementation.
 * Every key passed to putObject/getObject/deleteObject/listObjects/
 * getSignedUrl is automatically rewritten to
 *
 *   tenants/<tenantId>/<original-key>
 *
 * before reaching the underlying client. The wrapper fails closed when
 * a tenant cannot be resolved or when the original key already contains
 * an absolute scheme — a missing or malformed tenant is treated as a
 * programming error, never silently downgraded to an unprefixed key.
 *
 * Canon §5 default (single-tenant): construct with a fixed instance
 * customer code; the prefix is constant.
 * Canon §5 SOFTEN (pooled mode): construct with a resolver (function or
 * TenantContextPort) that consults RequestContext per request.
 *
 * The wrapper preserves the StorageClient interface exactly so it is a
 * drop-in replacement at every injection point — callers continue to
 * pass logical keys like `datasets/x.parquet` and remain unaware of the
 * prefix.
 */
export class TenantScopedStorageClient implements StorageClient {
  private readonly resolveTenantId: () => string;

  constructor(
    private readonly inner: StorageClient,
    resolver: TenantIdResolver,
  ) {
    if (resolver === undefined || resolver === null) {
      throw new Error(
        'TenantScopedStorageClient requires a tenant resolver (string, function, or TenantContextPort)',
      );
    }
    if (typeof resolver === 'string') {
      const fixed = resolver;
      this.assertValidTenantId(fixed);
      this.resolveTenantId = () => fixed;
    } else if (typeof resolver === 'function') {
      this.resolveTenantId = resolver;
    } else if (typeof (resolver as TenantContextPort).resolveTenantId === 'function') {
      const port = resolver as TenantContextPort;
      this.resolveTenantId = () => port.resolveTenantId();
    } else {
      throw new Error(
        'TenantScopedStorageClient resolver must be a string, function, or TenantContextPort',
      );
    }
  }

  async ensureBucket(bucket: string): Promise<void> {
    // Buckets themselves are not tenant-scoped — the prefix lives in the
    // key, not the bucket name. Forward verbatim so single-tenant and
    // pooled deployments share the same bucket inventory.
    return this.inner.ensureBucket(bucket);
  }

  async putObject(params: PutObjectParams): Promise<void> {
    return this.inner.putObject({ ...params, key: this.scopedKey(params.key) });
  }

  async getObject(params: GetObjectParams): Promise<Buffer> {
    return this.inner.getObject({ ...params, key: this.scopedKey(params.key) });
  }

  async deleteObject(params: DeleteObjectParams): Promise<void> {
    return this.inner.deleteObject({ ...params, key: this.scopedKey(params.key) });
  }

  async listObjects(params: ListObjectsParams): Promise<string[]> {
    const tenantId = this.resolveAndValidateTenantId();
    const tenantBase = `${TENANT_KEY_PREFIX_SEGMENT}/${tenantId}/`;
    const scopedPrefix = this.scopedListPrefix(params.prefix, tenantBase);
    const rawKeys = await this.inner.listObjects({
      ...params,
      prefix: scopedPrefix,
    });
    // Strip only the tenant-prefix portion back off so callers continue
    // to see logical keys identical to what they would pass to
    // getObject / putObject — the prefix is an enforcement detail, not
    // part of the caller's mental model. A returned key that does NOT
    // carry the tenant prefix is a sign of a corrupt or cross-tenant
    // leak and is filtered out defensively rather than surfaced.
    return rawKeys
      .filter((key) => key.startsWith(tenantBase))
      .map((key) => key.slice(tenantBase.length))
      .filter((key) => key.length > 0);
  }

  async getSignedUrl(params: SignedUrlParams): Promise<string> {
    return this.inner.getSignedUrl({ ...params, key: this.scopedKey(params.key) });
  }

  private scopedKey(rawKey: string): string {
    if (rawKey === undefined || rawKey === null || rawKey === '') {
      throw new Error('Storage key is required');
    }
    if (typeof rawKey !== 'string') {
      throw new Error('Storage key must be a string');
    }
    if (rawKey.includes('..')) {
      throw new Error(`Storage key may not contain '..': ${rawKey}`);
    }
    if (/^[a-z][a-z0-9+\-.]*:\/\//i.test(rawKey)) {
      // s3:// / https:// / etc. — caller passed a URL instead of a key.
      throw new Error(`Storage key must be relative, not a URL: ${rawKey}`);
    }
    const tenantId = this.resolveAndValidateTenantId();
    const trimmed = rawKey.replace(/^\/+/, '');
    return `${TENANT_KEY_PREFIX_SEGMENT}/${tenantId}/${trimmed}`;
  }

  private scopedListPrefix(rawPrefix: string | undefined, tenantBase: string): string {
    if (!rawPrefix) {
      return tenantBase;
    }
    if (typeof rawPrefix !== 'string') {
      throw new Error('Storage list prefix must be a string');
    }
    if (rawPrefix.includes('..')) {
      throw new Error(`Storage list prefix may not contain '..': ${rawPrefix}`);
    }
    const trimmed = rawPrefix.replace(/^\/+/, '');
    return `${tenantBase}${trimmed}`;
  }

  private resolveAndValidateTenantId(): string {
    const tenantId = this.resolveTenantId();
    this.assertValidTenantId(tenantId);
    return tenantId;
  }

  private assertValidTenantId(tenantId: unknown): void {
    if (tenantId === undefined || tenantId === null) {
      throw new Error('Tenant id is required for storage access');
    }
    if (typeof tenantId !== 'string') {
      throw new Error('Tenant id must be a string');
    }
    if (tenantId.trim().length === 0) {
      throw new Error('Tenant id is required for storage access');
    }
    if (!TENANT_ID_PATTERN.test(tenantId)) {
      throw new Error(
        `Tenant id contains characters not allowed in a storage key segment: ${tenantId}`,
      );
    }
  }
}
