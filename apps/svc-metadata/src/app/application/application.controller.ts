import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  CurrentUser,
  JwtAuthGuard,
  RequestUser,
  RequirePermission,
  Roles,
  RolesGuard,
} from '@hubblewave/auth-guard';
import { ApplicationService } from './application.service';
import { CreateApplicationDto, UpdateApplicationDto } from './application.dto';

/**
 * Application registry — the App Studio scope unit.
 *
 * Authorization: any authenticated user can list and read applications
 * (so non-admin admins can see their app inventory). Mutations require
 * either `admin.settings` OR the platform admin role; ADR-5 lifecycle
 * transitions (publish, deprecate) require the same.
 */
@Controller('applications')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ApplicationController {
  constructor(private readonly applications: ApplicationService) {}

  @Get()
  @RequirePermission('admin.settings')
  list() {
    return this.applications.list();
  }

  @Get(':id')
  @RequirePermission('admin.settings')
  getById(@Param('id', ParseUUIDPipe) id: string) {
    return this.applications.getById(id);
  }

  @Get('code/:code')
  @RequirePermission('admin.settings')
  getByCode(@Param('code') code: string) {
    return this.applications.getByCode(code);
  }

  @Get(':id/revisions')
  @RequirePermission('admin.settings')
  listRevisions(@Param('id', ParseUUIDPipe) id: string) {
    return this.applications.listRevisions(id);
  }

  @Post()
  @Roles('admin')
  @RequirePermission('admin.settings')
  create(
    @Body() dto: CreateApplicationDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.applications.create(dto, user?.id);
  }

  @Patch(':id')
  @Roles('admin')
  @RequirePermission('admin.settings')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateApplicationDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.applications.update(id, dto, user?.id);
  }

  @Post(':id/publish')
  @Roles('admin')
  @RequirePermission('admin.settings')
  publish(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.applications.publish(id, user?.id);
  }

  @Post(':id/deprecate')
  @Roles('admin')
  @RequirePermission('admin.settings')
  deprecate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.applications.deprecate(id, user?.id);
  }
}
