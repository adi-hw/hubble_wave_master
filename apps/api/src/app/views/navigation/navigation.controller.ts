import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  AuthenticatedOnly,
  CurrentUser,
  JwtAuthGuard,
  RequestUser,
} from '@hubblewave/auth-guard';
import { NavigationService } from './navigation.service';
import type { NavigationResolveInput, ResolvedNavigation } from './navigation.types';

/**
 * Canon §28 / W2 Stream 3 — view-side navigation resolution (the
 * user's effective navigation tree, with role + group filters
 * applied in the service).
 */
@AuthenticatedOnly()
@Controller('navigation')
@UseGuards(JwtAuthGuard)
export class NavigationController {
  constructor(private readonly navigationService: NavigationService) {}

  @Get('resolve')
  async resolve(
    @Query('code') code: NavigationResolveInput['code'],
    @CurrentUser() user: RequestUser,
  ): Promise<ResolvedNavigation> {
    const context = await this.navigationService.buildContext(user.id, user.roleCodes || []);
    return this.navigationService.resolveNavigation({ code }, context);
  }
}
