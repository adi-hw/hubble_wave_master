import {
  DeleteObjectParams,
  GetObjectParams,
  ListObjectsParams,
  PutObjectParams,
  SignedUrlParams,
  StorageClient,
} from './storage.client';
import {
  TENANT_KEY_PREFIX_SEGMENT,
  TenantScopedStorageClient,
} from './tenant-scoped-storage.client';
import { TenantContextPort } from './tenant-context.port';

const TENANT_ID = 'acme-co';

function buildInnerStub(): jest.Mocked<StorageClient> {
  return {
    ensureBucket: jest.fn().mockResolvedValue(undefined),
    putObject: jest.fn().mockResolvedValue(undefined),
    getObject: jest.fn().mockResolvedValue(Buffer.from('payload')),
    deleteObject: jest.fn().mockResolvedValue(undefined),
    listObjects: jest.fn().mockResolvedValue([]),
    getSignedUrl: jest.fn().mockResolvedValue('https://signed.example/object'),
  } as unknown as jest.Mocked<StorageClient>;
}

describe('TenantScopedStorageClient', () => {
  describe('constructor — fixed tenant id (single-tenant mode)', () => {
    it('accepts a non-empty tenant id string', () => {
      const inner = buildInnerStub();
      expect(() => new TenantScopedStorageClient(inner, TENANT_ID)).not.toThrow();
    });

    it('rejects an empty tenant id string', () => {
      const inner = buildInnerStub();
      expect(() => new TenantScopedStorageClient(inner, '')).toThrow(
        /tenant id is required/i,
      );
    });

    it('rejects a whitespace-only tenant id string', () => {
      const inner = buildInnerStub();
      expect(() => new TenantScopedStorageClient(inner, '   ')).toThrow(
        /tenant id/i,
      );
    });

    it('rejects a tenant id containing a path separator', () => {
      const inner = buildInnerStub();
      expect(
        () => new TenantScopedStorageClient(inner, 'tenant/escape'),
      ).toThrow(/not allowed in a storage key segment/i);
    });

    it('rejects null/undefined resolver', () => {
      const inner = buildInnerStub();
      expect(
        () =>
          new TenantScopedStorageClient(
            inner,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            null as any,
          ),
      ).toThrow(/requires a tenant resolver/i);
      expect(
        () =>
          new TenantScopedStorageClient(
            inner,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            undefined as any,
          ),
      ).toThrow(/requires a tenant resolver/i);
    });

    it('rejects an unsupported resolver shape', () => {
      const inner = buildInnerStub();
      expect(
        () =>
          new TenantScopedStorageClient(
            inner,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            { notARealPort: true } as any,
          ),
      ).toThrow(/must be a string, function, or TenantContextPort/i);
    });
  });

  describe('constructor — tenant resolver function (pooled mode)', () => {
    it('invokes the resolver per storage call (per-request)', async () => {
      const inner = buildInnerStub();
      const resolver = jest
        .fn<string, []>()
        .mockReturnValueOnce('tenant-a')
        .mockReturnValueOnce('tenant-b');
      const client = new TenantScopedStorageClient(inner, resolver);

      await client.putObject({
        bucket: 'b',
        key: 'foo.txt',
        body: Buffer.from('x'),
      });
      await client.putObject({
        bucket: 'b',
        key: 'foo.txt',
        body: Buffer.from('x'),
      });

      expect(resolver).toHaveBeenCalledTimes(2);
      expect(inner.putObject).toHaveBeenNthCalledWith(1, {
        bucket: 'b',
        key: 'tenants/tenant-a/foo.txt',
        body: expect.any(Buffer),
      });
      expect(inner.putObject).toHaveBeenNthCalledWith(2, {
        bucket: 'b',
        key: 'tenants/tenant-b/foo.txt',
        body: expect.any(Buffer),
      });
    });

    it('fails closed when the resolver returns an empty string', async () => {
      const inner = buildInnerStub();
      const client = new TenantScopedStorageClient(inner, () => '');
      await expect(
        client.putObject({ bucket: 'b', key: 'foo.txt', body: Buffer.from('x') }),
      ).rejects.toThrow(/tenant id is required/i);
      expect(inner.putObject).not.toHaveBeenCalled();
    });

    it('fails closed when the resolver throws', async () => {
      const inner = buildInnerStub();
      const client = new TenantScopedStorageClient(inner, () => {
        throw new Error('no tenant in scope');
      });
      await expect(
        client.putObject({ bucket: 'b', key: 'foo.txt', body: Buffer.from('x') }),
      ).rejects.toThrow(/no tenant in scope/);
      expect(inner.putObject).not.toHaveBeenCalled();
    });
  });

  describe('constructor — TenantContextPort (pooled mode via DI port)', () => {
    it('delegates per call to the port.resolveTenantId()', async () => {
      const inner = buildInnerStub();
      const port: TenantContextPort = {
        resolveTenantId: jest.fn().mockReturnValue('tenant-via-port'),
      };
      const client = new TenantScopedStorageClient(inner, port);

      await client.putObject({
        bucket: 'b',
        key: 'foo.txt',
        body: Buffer.from('x'),
      });

      expect(port.resolveTenantId).toHaveBeenCalledTimes(1);
      expect(inner.putObject).toHaveBeenCalledWith({
        bucket: 'b',
        key: 'tenants/tenant-via-port/foo.txt',
        body: expect.any(Buffer),
      });
    });
  });

  describe('key prefixing — putObject', () => {
    it('prepends tenants/<id>/ to the supplied key', async () => {
      const inner = buildInnerStub();
      const client = new TenantScopedStorageClient(inner, TENANT_ID);
      const params: PutObjectParams = {
        bucket: 'bucket-1',
        key: 'datasets/foo.parquet',
        body: Buffer.from('data'),
        contentType: 'application/octet-stream',
        metadata: { kind: 'dataset' },
      };

      await client.putObject(params);

      expect(inner.putObject).toHaveBeenCalledWith({
        bucket: 'bucket-1',
        key: `${TENANT_KEY_PREFIX_SEGMENT}/${TENANT_ID}/datasets/foo.parquet`,
        body: params.body,
        contentType: params.contentType,
        metadata: params.metadata,
      });
    });

    it('strips a single leading slash on the caller-supplied key before joining', async () => {
      const inner = buildInnerStub();
      const client = new TenantScopedStorageClient(inner, TENANT_ID);
      await client.putObject({
        bucket: 'b',
        key: '/foo.txt',
        body: Buffer.from('x'),
      });
      expect(inner.putObject).toHaveBeenCalledWith(
        expect.objectContaining({ key: `tenants/${TENANT_ID}/foo.txt` }),
      );
    });

    it('rejects an empty key', async () => {
      const inner = buildInnerStub();
      const client = new TenantScopedStorageClient(inner, TENANT_ID);
      await expect(
        client.putObject({ bucket: 'b', key: '', body: Buffer.from('x') }),
      ).rejects.toThrow(/storage key is required/i);
      expect(inner.putObject).not.toHaveBeenCalled();
    });

    it("rejects a key containing '..' to defeat traversal", async () => {
      const inner = buildInnerStub();
      const client = new TenantScopedStorageClient(inner, TENANT_ID);
      await expect(
        client.putObject({
          bucket: 'b',
          key: '../other-tenant/secret.txt',
          body: Buffer.from('x'),
        }),
      ).rejects.toThrow(/'\.\.'/);
      expect(inner.putObject).not.toHaveBeenCalled();
    });

    it('rejects a key that is actually a URL', async () => {
      const inner = buildInnerStub();
      const client = new TenantScopedStorageClient(inner, TENANT_ID);
      await expect(
        client.putObject({
          bucket: 'b',
          key: 's3://other-bucket/key',
          body: Buffer.from('x'),
        }),
      ).rejects.toThrow(/must be relative, not a URL/);
      expect(inner.putObject).not.toHaveBeenCalled();
    });
  });

  describe('key prefixing — getObject', () => {
    it('prepends tenants/<id>/ to the supplied key', async () => {
      const inner = buildInnerStub();
      const client = new TenantScopedStorageClient(inner, TENANT_ID);
      const params: GetObjectParams = { bucket: 'b', key: 'datasets/foo.parquet' };

      await client.getObject(params);

      expect(inner.getObject).toHaveBeenCalledWith({
        bucket: 'b',
        key: `tenants/${TENANT_ID}/datasets/foo.parquet`,
      });
    });

    it('returns whatever buffer the inner client returns verbatim', async () => {
      const inner = buildInnerStub();
      const payload = Buffer.from('inner-payload');
      inner.getObject.mockResolvedValueOnce(payload);
      const client = new TenantScopedStorageClient(inner, TENANT_ID);

      const result = await client.getObject({ bucket: 'b', key: 'k' });

      expect(result).toBe(payload);
    });
  });

  describe('key prefixing — deleteObject', () => {
    it('prepends tenants/<id>/ to the supplied key', async () => {
      const inner = buildInnerStub();
      const client = new TenantScopedStorageClient(inner, TENANT_ID);
      const params: DeleteObjectParams = { bucket: 'b', key: 'datasets/foo.parquet' };

      await client.deleteObject(params);

      expect(inner.deleteObject).toHaveBeenCalledWith({
        bucket: 'b',
        key: `tenants/${TENANT_ID}/datasets/foo.parquet`,
      });
    });
  });

  describe('key prefixing — getSignedUrl', () => {
    it('prepends tenants/<id>/ to the supplied key for put operations', async () => {
      const inner = buildInnerStub();
      const client = new TenantScopedStorageClient(inner, TENANT_ID);
      const params: SignedUrlParams = {
        bucket: 'b',
        key: 'datasets/foo.parquet',
        operation: 'put',
        expiresInSeconds: 600,
        contentType: 'application/octet-stream',
      };

      await client.getSignedUrl(params);

      expect(inner.getSignedUrl).toHaveBeenCalledWith({
        bucket: 'b',
        key: `tenants/${TENANT_ID}/datasets/foo.parquet`,
        operation: 'put',
        expiresInSeconds: 600,
        contentType: 'application/octet-stream',
      });
    });

    it('prepends tenants/<id>/ to the supplied key for get operations', async () => {
      const inner = buildInnerStub();
      const client = new TenantScopedStorageClient(inner, TENANT_ID);

      await client.getSignedUrl({
        bucket: 'b',
        key: 'foo.parquet',
        operation: 'get',
      });

      expect(inner.getSignedUrl).toHaveBeenCalledWith({
        bucket: 'b',
        key: `tenants/${TENANT_ID}/foo.parquet`,
        operation: 'get',
      });
    });

    it('returns the inner-signed URL verbatim', async () => {
      const inner = buildInnerStub();
      inner.getSignedUrl.mockResolvedValueOnce('https://signed-by-inner.example');
      const client = new TenantScopedStorageClient(inner, TENANT_ID);

      const url = await client.getSignedUrl({
        bucket: 'b',
        key: 'foo.parquet',
        operation: 'get',
      });

      expect(url).toBe('https://signed-by-inner.example');
    });
  });

  describe('key prefixing — listObjects', () => {
    it('combines the tenant prefix with the supplied prefix', async () => {
      const inner = buildInnerStub();
      const client = new TenantScopedStorageClient(inner, TENANT_ID);
      const params: ListObjectsParams = { bucket: 'b', prefix: 'datasets/' };

      await client.listObjects(params);

      expect(inner.listObjects).toHaveBeenCalledWith({
        bucket: 'b',
        prefix: `tenants/${TENANT_ID}/datasets/`,
      });
    });

    it('uses tenants/<id>/ as the prefix when caller omits the prefix', async () => {
      const inner = buildInnerStub();
      const client = new TenantScopedStorageClient(inner, TENANT_ID);

      await client.listObjects({ bucket: 'b' });

      expect(inner.listObjects).toHaveBeenCalledWith({
        bucket: 'b',
        prefix: `tenants/${TENANT_ID}/`,
      });
    });

    it('strips the tenant prefix from returned keys so callers see logical keys', async () => {
      const inner = buildInnerStub();
      inner.listObjects.mockResolvedValueOnce([
        `tenants/${TENANT_ID}/datasets/a.parquet`,
        `tenants/${TENANT_ID}/datasets/b.parquet`,
      ]);
      const client = new TenantScopedStorageClient(inner, TENANT_ID);

      const keys = await client.listObjects({ bucket: 'b', prefix: 'datasets/' });

      expect(keys).toEqual(['datasets/a.parquet', 'datasets/b.parquet']);
    });

    it('defensively filters keys that do not belong to the active tenant', async () => {
      const inner = buildInnerStub();
      inner.listObjects.mockResolvedValueOnce([
        `tenants/${TENANT_ID}/datasets/a.parquet`,
        // A leaked cross-tenant key that should never appear given the
        // prefix we sent, but the wrapper filters it as belt-and-
        // suspenders rather than passing through.
        'tenants/other-tenant/datasets/b.parquet',
      ]);
      const client = new TenantScopedStorageClient(inner, TENANT_ID);

      const keys = await client.listObjects({ bucket: 'b', prefix: 'datasets/' });

      expect(keys).toEqual(['datasets/a.parquet']);
    });

    it("rejects a list prefix containing '..'", async () => {
      const inner = buildInnerStub();
      const client = new TenantScopedStorageClient(inner, TENANT_ID);
      await expect(
        client.listObjects({ bucket: 'b', prefix: '../other-tenant/' }),
      ).rejects.toThrow(/'\.\.'/);
      expect(inner.listObjects).not.toHaveBeenCalled();
    });
  });

  describe('ensureBucket', () => {
    it('forwards the bucket name verbatim (bucket is not tenant-scoped)', async () => {
      const inner = buildInnerStub();
      const client = new TenantScopedStorageClient(inner, TENANT_ID);

      await client.ensureBucket('hw-attachments');

      expect(inner.ensureBucket).toHaveBeenCalledWith('hw-attachments');
    });
  });
});
