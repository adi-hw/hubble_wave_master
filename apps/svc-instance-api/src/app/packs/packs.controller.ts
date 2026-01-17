import { Controller, Post, Get, Body, Query, Logger, HttpCode, HttpStatus } from '@nestjs/common';
import { PacksService } from './packs.service';

export interface PackInstallPayload {
  packCode: string;
  releaseId: string;
  manifest: unknown;
  artifactUrl: string;
}

export interface PackRollbackPayload {
  packCode: string;
  releaseId: string;
}

@Controller('packs')
export class PacksController {
  private readonly logger = new Logger(PacksController.name);

  constructor(private readonly packsService: PacksService) {}

  @Post('install')
  @HttpCode(HttpStatus.ACCEPTED)
  async install(@Body() payload: PackInstallPayload) {
    this.logger.log(`Received pack install request: ${payload.packCode}@${payload.releaseId}`);
    return this.packsService.install(payload);
  }

  @Post('rollback')
  @HttpCode(HttpStatus.ACCEPTED)
  async rollback(@Body() payload: PackRollbackPayload) {
    this.logger.log(`Received pack rollback request: ${payload.packCode}@${payload.releaseId}`);
    return this.packsService.rollback(payload);
  }

  @Get('releases')
  async listReleases(
    @Query('packCode') packCode?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
  ) {
    return this.packsService.listReleases({ packCode, status, limit });
  }
}
