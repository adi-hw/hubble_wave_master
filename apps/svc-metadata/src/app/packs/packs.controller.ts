import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { PackInstallGuard } from './pack-install.guard';
import { PacksService } from './packs.service';
import { PackCatalogInstallRequest, PackInstallRequest, PackReleaseQuery, PackRollbackRequest } from './packs.dto';
import { PackCatalogService } from './pack-catalog.service';

@Controller('packs')
@UseGuards(PackInstallGuard)
export class PacksController {
  constructor(
    private readonly packsService: PacksService,
    private readonly catalogService: PackCatalogService,
  ) {}

  @Get('releases')
  listReleases(@Query('packCode') packCode?: string, @Query('status') status?: string, @Query('limit') limit?: string) {
    const query: PackReleaseQuery = {
      packCode,
      status,
      limit: limit ? parseInt(limit, 10) : undefined,
    };
    return this.packsService.listReleases(query);
  }

  @Post('install')
  install(@Body() body: PackInstallRequest, @Req() request: Request) {
    const userId = (request as any)?.context?.userId;
    const actorId = isUuid(userId) ? userId : undefined;
    const context = {
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    };
    return this.packsService.installPack(body, actorId, context);
  }

  @Get('catalog')
  listCatalog() {
    return this.catalogService.listCatalog();
  }

  @Post('catalog/install')
  async installFromCatalog(@Body() body: PackCatalogInstallRequest, @Req() request: Request) {
    const artifact = await this.catalogService.fetchArtifactBundle(body.packCode, body.releaseId);
    const userId = (request as any)?.context?.userId;
    const actorId = isUuid(userId) ? userId : undefined;
    const context = {
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    };
    return this.packsService.installPack(
      {
        packCode: artifact.packCode,
        releaseId: artifact.releaseId,
        manifest: artifact.manifest,
        artifactUrl: artifact.artifactUrl,
      },
      actorId,
      context
    );
  }

  @Post('rollback')
  rollback(@Body() body: PackRollbackRequest, @Req() request: Request) {
    const userId = (request as any)?.context?.userId;
    const actorId = isUuid(userId) ? userId : undefined;
    const context = {
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    };
    return this.packsService.rollbackPack(body, actorId, context);
  }
}

function isUuid(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false;
  }
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
    value.toLowerCase()
  );
}
