import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser, JwtAuthGuard, RequestUser, Roles, RolesGuard } from '@hubblewave/auth-guard';
import {
  CreateNavigationRequest,
  NavigationService,
  PublishNavigationRequest,
} from './navigation.service';

@Controller('navigation')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class NavigationController {
  constructor(private readonly navigationService: NavigationService) {}

  @Post()
  async createDraft(
    @Body() body: CreateNavigationRequest,
    @CurrentUser() user?: RequestUser,
  ) {
    return this.navigationService.createDraft(body, user?.id);
  }

  @Get()
  async listModules(@Query('code') code?: string) {
    return this.navigationService.listModules({ code });
  }

  @Post(':navigationCode/publish')
  async publish(
    @Param('navigationCode') navigationCode: string,
    @Body() body: PublishNavigationRequest,
    @CurrentUser() user?: RequestUser,
  ) {
    return this.navigationService.publishNavigation(navigationCode, body, user?.id);
  }

  @Get(':navigationCode/revisions')
  async listRevisions(@Param('navigationCode') navigationCode: string) {
    return this.navigationService.listRevisions(navigationCode);
  }

  @Get(':navigationCode/revisions/:revisionId')
  async getRevision(
    @Param('navigationCode') navigationCode: string,
    @Param('revisionId') revisionId: string,
  ) {
    return this.navigationService.getRevision(navigationCode, revisionId);
  }

  @Get(':navigationCode/variants')
  async listVariants(@Param('navigationCode') navigationCode: string) {
    return this.navigationService.listVariants(navigationCode);
  }

  @Post(':navigationCode/variants')
  async addVariant(
    @Param('navigationCode') navigationCode: string,
    @Body() body: CreateNavigationRequest['variant'],
    @CurrentUser() user?: RequestUser,
  ) {
    return this.navigationService.addVariant(navigationCode, body, user?.id);
  }
}
