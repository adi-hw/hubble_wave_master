import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  CurrentUser,
  JwtAuthGuard,
  PermissionsGuard,
  RequestUser,
  RequirePermission,
} from '@hubblewave/auth-guard';
import type { ChangePackageStatus, MetadataChange } from '@hubblewave/instance-db';
import {
  AddArtifactDto,
  ChangePackageService,
  CreatePackageDto,
  ImportPackageDto,
} from './change-package.service';

@Controller('change-packages')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ChangePackageController {
  constructor(private readonly service: ChangePackageService) {}

  @Get()
  @RequirePermission('metadata:change_package:manage')
  async list(
    @Query('applicationId') applicationId?: string,
    @Query('status') status?: ChangePackageStatus,
  ) {
    return { data: await this.service.list(applicationId, status) };
  }

  @Get(':id')
  @RequirePermission('metadata:change_package:manage')
  async get(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.get(id);
  }

  @Post()
  @RequirePermission('metadata:change_package:manage')
  async create(@Body() dto: CreatePackageDto, @CurrentUser() user?: RequestUser) {
    return this.service.create(dto, user?.id);
  }

  @Post(':id/artifacts')
  @RequirePermission('metadata:change_package:manage')
  async addArtifact(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddArtifactDto,
    @CurrentUser() user?: RequestUser,
  ) {
    return this.service.addArtifact(id, dto, user?.id);
  }

  @Delete(':id/artifacts/:kind/:code')
  @RequirePermission('metadata:change_package:manage')
  async removeArtifact(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('kind') kind: MetadataChange['kind'],
    @Param('code') code: string,
    @CurrentUser() user?: RequestUser,
  ) {
    return this.service.removeArtifact(id, kind, code, user?.id);
  }

  @Post(':id/complete')
  @RequirePermission('metadata:change_package:manage')
  async complete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user?: RequestUser,
  ) {
    const sourceInstanceId = process.env.INSTANCE_ID ?? 'unknown';
    return this.service.complete(id, sourceInstanceId, user?.id);
  }

  @Get(':id/export')
  @RequirePermission('metadata:change_package:manage')
  async exportJson(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.exportJson(id);
  }

  @Post('import')
  @RequirePermission('metadata:change_package:manage')
  @HttpCode(HttpStatus.CREATED)
  async importPackage(@Body() dto: ImportPackageDto, @CurrentUser() user?: RequestUser) {
    return this.service.importPackage(dto, user?.id);
  }
}
