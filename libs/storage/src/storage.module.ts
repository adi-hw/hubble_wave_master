import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { StorageConfig, loadStorageConfig } from './storage.config';
import { STORAGE_CLIENT, StorageClient } from './storage.client';
import { createMinioClient } from './minio/minio.client';
import { S3StorageClient } from './s3/s3.client';
import {
  TENANT_CONTEXT_PORT,
  TenantContextPort,
} from './tenant-context.port';
import {
  TenantScopedStorageClient,
} from './tenant-scoped-storage.client';

export const STORAGE_CONFIG = 'STORAGE_CONFIG';

/**
 * DI token for the tenant-scoped storage client (F140). Consumers that
 * operate on customer data MUST inject this token instead of
 * STORAGE_CLIENT — the wrapper auto-prefixes every key with
 * `tenants/<tenantId>/` so a missing prefix at the call site cannot
 * cause a cross-tenant leak. STORAGE_CLIENT remains exposed for
 * platform-global writes (e.g. control-plane pack artifacts) that are
 * intentionally not tenant-scoped.
 */
export const TENANT_SCOPED_STORAGE_CLIENT = 'TENANT_SCOPED_STORAGE_CLIENT';

@Module({})
export class StorageModule {
  /**
   * Wire the raw StorageClient + config. Apps that handle customer data
   * MUST additionally call forTenantScope() (or supply their own
   * TenantContextPort) so the tenant-scoped wrapper is available.
   */
  static forRoot(): DynamicModule {
    return {
      module: StorageModule,
      imports: [ConfigModule.forRoot({ isGlobal: true })],
      providers: [
        {
          provide: STORAGE_CONFIG,
          useFactory: (): StorageConfig => loadStorageConfig(),
        },
        {
          provide: STORAGE_CLIENT,
          useFactory: (config: StorageConfig): StorageClient =>
            config.provider === 'minio'
              ? createMinioClient(config)
              : new S3StorageClient(config),
          inject: [STORAGE_CONFIG],
        },
      ],
      exports: [STORAGE_CLIENT, STORAGE_CONFIG],
    };
  }

  /**
   * Single-tenant default: resolve the tenant prefix from a fixed
   * environment variable (INSTANCE_CODE, falling back to INSTANCE_ID).
   * The Nest app is wired exactly once per process, so binding the
   * tenant id here is correct for canon §5 default deployments.
   *
   * Pooled-mode apps SHOULD instead provide their own TenantContextPort
   * implementation that reads RequestContext per request, and bind it
   * to TENANT_CONTEXT_PORT — the same provider topology then yields a
   * per-request prefix.
   */
  static forTenantScope(): DynamicModule {
    return {
      module: StorageModule,
      imports: [ConfigModule.forRoot({ isGlobal: true })],
      providers: [
        {
          provide: STORAGE_CONFIG,
          useFactory: (): StorageConfig => loadStorageConfig(),
        },
        {
          provide: STORAGE_CLIENT,
          useFactory: (config: StorageConfig): StorageClient =>
            config.provider === 'minio'
              ? createMinioClient(config)
              : new S3StorageClient(config),
          inject: [STORAGE_CONFIG],
        },
        {
          provide: TENANT_CONTEXT_PORT,
          useFactory: (): TenantContextPort => ({
            resolveTenantId: () => resolveSingleTenantIdFromEnv(process.env),
          }),
        },
        {
          provide: TENANT_SCOPED_STORAGE_CLIENT,
          useFactory: (
            inner: StorageClient,
            tenantContext: TenantContextPort,
          ) => new TenantScopedStorageClient(inner, tenantContext),
          inject: [STORAGE_CLIENT, TENANT_CONTEXT_PORT],
        },
      ],
      exports: [
        STORAGE_CLIENT,
        STORAGE_CONFIG,
        TENANT_CONTEXT_PORT,
        TENANT_SCOPED_STORAGE_CLIENT,
      ],
    };
  }
}

/**
 * Single-tenant tenant-id resolver: prefer INSTANCE_CODE (the canonical
 * customer code used across the platform), fall back to INSTANCE_ID
 * (provisioning-assigned UUID). Throws if neither is set — canon §5
 * default deployments MUST have one of these wired in.
 */
function resolveSingleTenantIdFromEnv(
  env: Record<string, string | undefined>,
): string {
  const candidate =
    env['INSTANCE_CODE'] ||
    env['CUSTOMER_CODE'] ||
    env['INSTANCE_ID'] ||
    env['INSTANCE_NAME'];
  if (!candidate || candidate.trim().length === 0) {
    throw new Error(
      'Tenant id resolver: set INSTANCE_CODE (or CUSTOMER_CODE / INSTANCE_ID) to identify the customer this instance serves',
    );
  }
  return candidate.trim();
}
