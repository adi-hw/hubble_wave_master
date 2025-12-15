import { Injectable, NestMiddleware, NotFoundException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { TenantDbService } from '@eam-platform/tenant-db';

/**
 * Single-tenant architecture: Resolves tenant from environment variable or request context.
 * The default tenant (DEFAULT_TENANT_SLUG env var) is used for all requests.
 * Request headers/body can override for multi-tenant scenarios but defaults to single tenant.
 */
@Injectable()
export class TenantResolverMiddleware implements NestMiddleware {
  constructor(private readonly tenantDbService: TenantDbService) {}

  async use(req: Request & { tenant?: any; tenantSlug?: string }, _res: Response, next: NextFunction) {
    const path = req.originalUrl || req.url || '';
    const isHealthRoute = path.includes('/health');

    // Health routes don't need tenant context
    if (isHealthRoute) {
      return next();
    }

    // Single-tenant: use default tenant from environment
    const defaultSlug = process.env.DEFAULT_TENANT_SLUG || 'acme';

    // Try to resolve tenant (allows override via header for testing/flexibility)
    const headerSlug = (req.headers['x-tenant-slug'] as string | undefined) || undefined;
    const tenantSlug = headerSlug || defaultSlug;

    const tenant = await this.tenantDbService.findTenantBySlug(tenantSlug);

    if (!tenant) {
      throw new NotFoundException(`Tenant '${tenantSlug}' not found`);
    }

    req.tenant = tenant;
    req.tenantSlug = tenant.slug || undefined;
    next();
  }
}
