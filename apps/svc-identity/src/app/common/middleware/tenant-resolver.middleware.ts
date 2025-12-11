import { Injectable, NestMiddleware, NotFoundException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { TenantDbService } from '@eam-platform/tenant-db';

/**
 * Resolves tenant by Host header (subdomain) and attaches to req.tenant/req.tenantSlug.
 * Does not enforce auth; guards can validate JWT tenant matches this context.
 */
@Injectable()
export class TenantResolverMiddleware implements NestMiddleware {
  constructor(private readonly tenantDbService: TenantDbService) {}

  async use(req: Request & { tenant?: any; tenantSlug?: string }, _res: Response, next: NextFunction) {
    const host = req.headers.host;
    const headerSlug = (req.headers['x-tenant-slug'] as string | undefined) || undefined;
    const bodySlug = (req as any).body?.tenantSlug as string | undefined;
    const querySlug = (req.query as any)?.tenantSlug as string | undefined;
    const defaultSlug = process.env.DEFAULT_TENANT_SLUG || 'acme';
    const allowFallback = process.env.ALLOW_DEFAULT_TENANT_FALLBACK === 'true';

    // Allow unauthenticated/login routes to fall back to controller-level resolution
    const path = req.originalUrl || req.url || '';
    const isAuthRoute = path.includes('/auth/login') || path.includes('/auth/refresh');

    const tenant =
      (await this.tenantDbService.getTenantFromHost(host)) ||
      (headerSlug && (await this.tenantDbService.findTenantBySlug(headerSlug))) ||
      (bodySlug && (await this.tenantDbService.findTenantBySlug(bodySlug))) ||
      (querySlug && (await this.tenantDbService.findTenantBySlug(querySlug)));

    if (!tenant) {
      if (isAuthRoute && defaultSlug && allowFallback) {
        const fallback = await this.tenantDbService.findTenantBySlug(defaultSlug);
        if (fallback) {
          (req as any).tenant = fallback;
          (req as any).tenantSlug = fallback.slug;
          return next();
        }
        return next();
      }
      throw new NotFoundException('Tenant not found (host/header/body/query)');
    }

    req.tenant = tenant;
    req.tenantSlug = tenant.slug || undefined;
    next();
  }
}
