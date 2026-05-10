import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { Public } from '../auth/public.decorator';
import { InstanceTokenGuard } from '../auth/instance-token.guard';
import { PackDownloadUrlDto } from './packs.dto';
import { PacksService } from './packs.service';

@Public()
@UseGuards(InstanceTokenGuard)
@Controller('catalog/packs')
export class PacksCatalogController {
  constructor(private readonly packsService: PacksService) {}

  @Get()
  listCatalog() {
    return this.packsService.listInstallableCatalog();
  }

  @Get(':code/releases/:releaseId/artifact')
  getArtifactBundle(
    @Param('code') code: string,
    @Param('releaseId') releaseId: string,
    @Query() query: PackDownloadUrlDto,
  ) {
    if (!query.expiresInSeconds) {
      return this.packsService.createInstallableArtifactBundle(code, releaseId, 600);
    }
    const expires = Number(query.expiresInSeconds);
    if (!Number.isFinite(expires) || expires <= 0) {
      return this.packsService.createInstallableArtifactBundle(code, releaseId, 600);
    }
    return this.packsService.createInstallableArtifactBundle(code, releaseId, expires);
  }
}
