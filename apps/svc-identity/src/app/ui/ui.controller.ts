import { Body, Controller, Get, Put, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { UiService } from './ui.service';
import { Request } from 'express';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('UI')
@Controller()
export class UiController {
  constructor(private readonly uiService: UiService) {}

  // Public endpoints for initial page load (no auth required)
  @Public()
  @SkipThrottle()
  @Get('ui/theme')
  getTheme(@Req() req: Request) {
    const tenantId = (req as any).user?.tenantId;
    return this.uiService.getTheme(tenantId);
  }

  @Public()
  @SkipThrottle()
  @Get('ui/navigation')
  getNavigation(@Req() req: Request) {
    const tenantId = (req as any).user?.tenantId;
    return this.uiService.getNavigation(tenantId);
  }

  @Get('admin/ui/theme')
  getAdminTheme(@Req() req: Request) {
    const tenantId = (req as any).user?.tenantId;
    return this.uiService.getTheme(tenantId);
  }

  @Put('admin/ui/theme')
  updateAdminTheme(@Req() req: Request, @Body() body: any) {
    const tenantId = (req as any).user?.tenantId;
    const userId = (req as any).user?.userId;
    return this.uiService.updateTheme(tenantId, body ?? {}, userId);
  }

  @Get('admin/ui/nav-profile')
  getAdminNavProfile(@Req() req: Request) {
    const tenantId = (req as any).user?.tenantId;
    return this.uiService.getNavigation(tenantId);
  }

  @Put('admin/ui/nav-profile')
  updateAdminNavProfile(@Req() req: Request, @Body() body: any) {
    const tenantId = (req as any).user?.tenantId;
    return this.uiService.updateNavigation(tenantId, body ?? {});
  }
}
