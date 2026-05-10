import { BadRequestException, Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import {
  PackDownloadUrlDto,
  PackInstallDto,
  PackInstallStatusDto,
  PackRollbackDto,
  PackRegisterDto,
  PackUploadUrlDto,
} from './packs.dto';
import { PacksService } from './packs.service';

@Controller('packs')
@Roles('operator')
export class PacksController {
  constructor(private readonly packsService: PacksService) {}

  @Post('upload-url')
  createUploadUrl(@Body() dto: PackUploadUrlDto) {
    return this.packsService.createUploadUrl(dto);
  }

  @Post('register')
  registerPack(@Body() dto: PackRegisterDto, @CurrentUser('id') userId: string) {
    return this.packsService.registerPack(dto, userId);
  }

  @Get()
  listPacks() {
    return this.packsService.listPacks();
  }

  @Get('install-status')
  getInstallStatus(@Query() query: PackInstallStatusDto) {
    return this.packsService.getInstallStatus(query);
  }

  @Get(':code')
  getPack(@Param('code') code: string) {
    return this.packsService.getPack(code);
  }

  @Get(':code/releases/:releaseId')
  getRelease(@Param('code') code: string, @Param('releaseId') releaseId: string) {
    return this.packsService.getRelease(code, releaseId);
  }

  @Get(':code/releases/:releaseId/download-url')
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
  triggerInstall(@Body() dto: PackInstallDto, @CurrentUser('id') userId: string) {
    return this.packsService.triggerInstall(dto, userId);
  }

  @Post('rollback')
  triggerRollback(@Body() dto: PackRollbackDto, @CurrentUser('id') userId: string) {
    return this.packsService.triggerRollback(dto, userId);
  }
}
