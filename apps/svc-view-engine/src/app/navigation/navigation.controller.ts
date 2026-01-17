import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CurrentUser, JwtAuthGuard, RequestUser } from '@hubblewave/auth-guard';
import { NavigationService } from './navigation.service';
import type { NavigationResolveInput, ResolvedNavigation } from './navigation.types';

@Controller('navigation')
@UseGuards(JwtAuthGuard)
export class NavigationController {
  constructor(private readonly navigationService: NavigationService) {}

  @Get('resolve')
  async resolve(
    @Query('code') code: NavigationResolveInput['code'],
    @CurrentUser() user: RequestUser,
  ): Promise<ResolvedNavigation> {
    const context = await this.navigationService.buildContext(user.id, user.roles || []);
    return this.navigationService.resolveNavigation({ code }, context);
  }
}
