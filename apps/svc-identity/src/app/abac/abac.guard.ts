import { CanActivate, ExecutionContext, Injectable, UnauthorizedException, ForbiddenException, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AbacService } from './abac.service';

export const ABAC_RESOURCE_KEY = 'abac_resource';
export const AbacResource = (resource: string, action: string, resourceType: 'table' | 'field' | 'action' = 'action') =>
  SetMetadata(ABAC_RESOURCE_KEY, { resource, action, resourceType });

@Injectable()
export class AbacGuard implements CanActivate {
  constructor(private reflector: Reflector, private abacService: AbacService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const meta = this.reflector.get<{ resource: string; action: string }>(ABAC_RESOURCE_KEY, context.getHandler());
    if (!meta) return true; // No ABAC metadata, skip

    const req = context.switchToHttp().getRequest();
    if (!req.user) {
      throw new UnauthorizedException();
    }

    const { resource, action, resourceType = 'action' } = meta as { resource: string; action: string; resourceType?: 'table' | 'field' | 'action' };

    // Build a simple context from user + params + body for evaluation
    const evaluationContext = {
      user: req.user,
      params: req.params,
      body: req.body,
    };

    const allowed = await this.abacService.isAllowed(resource, action, evaluationContext, resourceType);
    if (!allowed) throw new ForbiddenException('ABAC policy denied');
    return true;
  }
}
