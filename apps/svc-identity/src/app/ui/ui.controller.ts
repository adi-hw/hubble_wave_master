import { Body, Controller, Get, Put, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { UiService } from './ui.service';
import { Request } from 'express';

/**
 * Helper to extract tenantId from authenticated request.
 * Single-tenant architecture: gets tenantId from JWT user context.
 */
function getTenantId(req: Request): string {
  // Get from JWT token (authenticated user context)
  const tenantId = (req as any).user?.tenantId;
  if (!tenantId) {
    throw new Error('Tenant context required - user must be authenticated');
  }
  return tenantId;
}

@ApiTags('UI')
@Controller()
export class UiController {
  constructor(private readonly uiService: UiService) {}

  // All UI endpoints require authentication (no @Public decorator)
  @SkipThrottle()
  @Get('ui/theme')
  getTheme(@Req() req: Request) {
    const tenantId = getTenantId(req);
    return this.uiService.getTheme(tenantId);
  }

  @SkipThrottle()
  @Get('ui/navigation')
  getNavigation(@Req() req: Request) {
    const tenantId = getTenantId(req);
    return this.uiService.getNavigation(tenantId);
  }

  @Get('admin/ui/theme')
  getAdminTheme(@Req() req: Request) {
    const tenantId = getTenantId(req);
    return this.uiService.getTheme(tenantId);
  }

  @Put('admin/ui/theme')
  updateAdminTheme(@Req() req: Request, @Body() body: any) {
    const tenantId = getTenantId(req);
    const userId = (req as any).user?.userId;
    return this.uiService.updateTheme(tenantId, body ?? {}, userId);
  }

  @Get('admin/ui/nav-profile')
  getAdminNavProfile(@Req() req: Request) {
    const tenantId = getTenantId(req);
    return this.uiService.getNavigation(tenantId);
  }

  @Put('admin/ui/nav-profile')
  updateAdminNavProfile(@Req() req: Request, @Body() body: any) {
    const tenantId = getTenantId(req);
    return this.uiService.updateNavigation(tenantId, body ?? {});
  }
}
