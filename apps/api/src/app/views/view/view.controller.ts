import { Controller, ForbiddenException, Get, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, InstanceRequest, extractContext } from '@hubblewave/auth-guard';
import { ViewService } from './view.service';
import type { ResolvedView, ViewResolveInput } from './view.types';

@Controller('views')
@UseGuards(JwtAuthGuard)
export class ViewController {
  constructor(private readonly viewService: ViewService) {}

  /**
   * Plan §7.2 — `previewAsRole` enables Form Builder's "Preview as
   * role X" mode. When supplied, variant resolution runs against the
   * named role list (CSV) instead of the caller's actual roles. Only
   * admins or callers holding `metadata:form:manage` can override —
   * for everyone else the parameter is ignored and the response uses
   * the caller's real role context.
   */
  @Get('resolve')
  async resolve(
    @Query('route') route: string | undefined,
    @Query('kind') kind: ViewResolveInput['kind'],
    @Query('collection') collection: string | undefined,
    @Query('code') code: string | undefined,
    @Query('previewAsRole') previewAsRole: string | undefined,
    @Req() req: InstanceRequest,
  ): Promise<ResolvedView> {
    const authContext = extractContext(req);
    let effectiveRoles = authContext.roleCodes || [];
    if (previewAsRole) {
      const canPreview =
        authContext.roleCodes?.includes('admin') ||
        authContext.permissionCodes?.includes('metadata:form:manage');
      if (!canPreview) {
        throw new ForbiddenException(
          'previewAsRole requires `metadata:form:manage` or admin role',
        );
      }
      effectiveRoles = previewAsRole.split(',').map((r) => r.trim()).filter(Boolean);
    }
    const context = await this.viewService.buildContext(authContext.userId, effectiveRoles);
    return this.viewService.resolveView({ route, kind, collection, code }, context, authContext);
  }
}
