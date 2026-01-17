import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser, JwtAuthGuard, RequestUser, Roles, RolesGuard } from '@hubblewave/auth-guard';
import { CreateViewRequest, PublishViewRequest, ViewService } from './view.service';

@Controller('views')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class ViewController {
  constructor(private readonly viewService: ViewService) {}

  @Post()
  async createDraft(
    @Body() body: CreateViewRequest,
    @CurrentUser() user?: RequestUser,
  ) {
    return this.viewService.createDraft(body, user?.id);
  }

  @Get()
  async listDefinitions(
    @Query('kind') kind?: CreateViewRequest['kind'],
    @Query('collection') collection?: string,
    @Query('code') code?: string,
  ) {
    return this.viewService.listDefinitions({ kind, collection, code });
  }

  @Post(':viewCode/publish')
  async publish(
    @Param('viewCode') viewCode: string,
    @Body() body: PublishViewRequest,
    @CurrentUser() user?: RequestUser,
  ) {
    return this.viewService.publishView(viewCode, body, user?.id);
  }

  @Get(':viewCode/revisions')
  async listRevisions(@Param('viewCode') viewCode: string) {
    return this.viewService.listRevisions(viewCode);
  }

  @Get(':viewCode/revisions/:revisionId')
  async getRevision(
    @Param('viewCode') viewCode: string,
    @Param('revisionId') revisionId: string,
  ) {
    return this.viewService.getRevision(viewCode, revisionId);
  }

  @Get(':viewCode/variants')
  async listVariants(@Param('viewCode') viewCode: string) {
    return this.viewService.listVariants(viewCode);
  }

  @Post(':viewCode/variants')
  async addVariant(
    @Param('viewCode') viewCode: string,
    @Body() body: CreateViewRequest['variant'],
    @CurrentUser() user?: RequestUser,
  ) {
    return this.viewService.addVariant(viewCode, body, user?.id);
  }
}
