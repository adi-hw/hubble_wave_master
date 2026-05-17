import { Body, Controller, Get, Put, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { UiService } from './ui.service';
import { InstanceRequest, assertUserContext } from '@hubblewave/auth-guard';
import { AuthenticatedOnly } from '../auth/decorators/public.decorator';
import { RequirePermission } from '../roles/decorators/permission.decorator';

@ApiTags('UI')
@Controller()
export class UiController {
  constructor(private readonly uiService: UiService) {}

  // Theme and navigation are visible to any authenticated user; the UI can't
  // render without them.
  @SkipThrottle()
  @Get('ui/theme')
  @AuthenticatedOnly()
  getTheme() {
    return this.uiService.getTheme();
  }

  @SkipThrottle()
  @Get('ui/navigation')
  @AuthenticatedOnly()
  getNavigation() {
    return this.uiService.getNavigation();
  }

  @Get('admin/ui/theme')
  @RequirePermission('system:configure')
  getAdminTheme() {
    return this.uiService.getTheme();
  }

  @Put('admin/ui/theme')
  @RequirePermission('system:configure')
  updateAdminTheme(@Req() req: InstanceRequest, @Body() body: any) {
    const ctx = assertUserContext(req.context);
    return this.uiService.updateTheme(body ?? {}, ctx.userId);
  }

  @Get('admin/ui/nav-profile')
  @RequirePermission('metadata:navigation:manage')
  getAdminNavProfile() {
    return this.uiService.getNavigation();
  }

  @Put('admin/ui/nav-profile')
  @RequirePermission('metadata:navigation:manage')
  updateAdminNavProfile(@Body() body: any) {
    return this.uiService.updateNavigation(body ?? {});
  }
}
