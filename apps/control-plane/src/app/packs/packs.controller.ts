import { BadRequestException, Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { RequirePermission } from '../auth/require-permission.decorator';
import {
  PackDownloadUrlDto,
  PackInstallDto,
  PackInstallStatusDto,
  PackRollbackDto,
  PackRegisterDto,
  PackUploadUrlDto,
} from './packs.dto';
import { PacksService } from './packs.service';

/**
 * Canon §28 / W2 Stream 3 — vertical pack catalog + install surface.
 * Reads gated by `control_plane:pack:read`; mutations (upload URL
 * generation, pack registration, install / rollback triggering) by
 * `control_plane:pack:manage`.
 */
@Controller('packs')
export class PacksController {
  constructor(private readonly packsService: PacksService) {}

  @Post('upload-url')
  @RequirePermission('control_plane:pack:manage')
  createUploadUrl(@Body() dto: PackUploadUrlDto) {
    return this.packsService.createUploadUrl(dto);
  }

  @Post('register')
  @RequirePermission('control_plane:pack:manage')
  registerPack(@Body() dto: PackRegisterDto, @CurrentUser('id') userId: string) {
    return this.packsService.registerPack(dto, userId);
  }

  @Get()
  @RequirePermission('control_plane:pack:read')
  listPacks() {
    return this.packsService.listPacks();
  }

  @Get('install-status')
  @RequirePermission('control_plane:pack:read')
  getInstallStatus(@Query() query: PackInstallStatusDto) {
    return this.packsService.getInstallStatus(query);
  }

  @Get(':code')
  @RequirePermission('control_plane:pack:read')
  getPack(@Param('code') code: string) {
    return this.packsService.getPack(code);
  }

  @Get(':code/releases/:releaseId')
  @RequirePermission('control_plane:pack:read')
  getRelease(@Param('code') code: string, @Param('releaseId') releaseId: string) {
    return this.packsService.getRelease(code, releaseId);
  }

  @Get(':code/releases/:releaseId/download-url')
  @RequirePermission('control_plane:pack:read')
  getDownloadUrl(
    @Param('code') code: string,
    @Param('releaseId') releaseId: string,
    @Query() query: PackDownloadUrlDto,
  ) {
    if (!query.expiresInSeconds) {
      return this.packsService.createDownloadUrl(code, releaseId, 600);
    }
    const expires = Number(query.expiresInSeconds);
    if (!Number.isFinite(expires) || expires <= 0) {
      throw new BadRequestException('expiresInSeconds must be a positive number');
    }
    return this.packsService.createDownloadUrl(code, releaseId, expires);
  }

  @Post('install')
  @RequirePermission('control_plane:pack:manage')
  triggerInstall(@Body() dto: PackInstallDto, @CurrentUser('id') userId: string) {
    return this.packsService.triggerInstall(dto, userId);
  }

  @Post('rollback')
  @RequirePermission('control_plane:pack:manage')
  triggerRollback(@Body() dto: PackRollbackDto, @CurrentUser('id') userId: string) {
    return this.packsService.triggerRollback(dto, userId);
  }
}
