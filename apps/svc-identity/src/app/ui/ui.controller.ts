import { Body, Controller, Get, Put, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { UiService } from './ui.service';
import { Request } from 'express';

@ApiTags('UI')
@Controller()
export class UiController {
  constructor(private readonly uiService: UiService) {}

  // All UI endpoints require authentication (no @Public decorator)
  @SkipThrottle()
  @Get('ui/theme')
  getTheme() {
    return this.uiService.getTheme();
  }

  @SkipThrottle()
  @Get('ui/navigation')
  getNavigation() {
    return this.uiService.getNavigation();
  }

  @Get('admin/ui/theme')
  getAdminTheme() {
    return this.uiService.getTheme();
  }

  @Put('admin/ui/theme')
  updateAdminTheme(@Req() req: Request, @Body() body: any) {
    const userId = (req as any).user?.userId;
    return this.uiService.updateTheme(body ?? {}, userId);
  }

  @Get('admin/ui/nav-profile')
  getAdminNavProfile() {
    return this.uiService.getNavigation();
  }

  @Put('admin/ui/nav-profile')
  updateAdminNavProfile(@Body() body: any) {
    return this.uiService.updateNavigation(body ?? {});
  }
}
