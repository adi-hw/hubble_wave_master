import { Injectable, NestMiddleware, NotFoundException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from '@eam-platform/platform-db';
import { extractTenantSlug } from './tenant-host.util';

@Injectable()
export class TenantResolveMiddleware implements NestMiddleware {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenantsRepo: Repository<Tenant>,
  ) {}

  async use(req: Request, _res: Response, next: NextFunction) {
    const slug = extractTenantSlug(req.headers.host || '');
    if (!slug) {
      // For now, we require a tenant slug. 
      // In future, we might allow global admin access without tenant slug, 
      // but for this architecture (Tenant-per-DB), almost everything is tenant-scoped.
      // Exception: Health checks, etc. handled by global prefix or exclusion.
      throw new NotFoundException('Tenant not found in host header');
    }

    const tenant = await this.tenantsRepo.findOne({ where: { slug } });
    if (!tenant) {
      throw new NotFoundException(`Tenant '${slug}' not found`);
    }

    if (tenant.status !== 'ACTIVE') {
        throw new NotFoundException(`Tenant '${slug}' is not active`);
    }

    // Attach tenant to request
    (req as any).tenant = tenant;
    next();
  }
}
