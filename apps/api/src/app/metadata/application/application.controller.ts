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
 * either `system:configure` OR the platform admin role; ADR-5 lifecycle
 * transitions (publish, deprecate) require the same.
 */
@Controller('applications')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ApplicationController {
  constructor(private readonly applications: ApplicationService) {}

  @Get()
  @RequirePermission('system:configure')
  list() {
    return this.applications.list();
  }

  @Get(':id')
  @RequirePermission('system:configure')
  getById(@Param('id', ParseUUIDPipe) id: string) {
    return this.applications.getById(id);
  }

  @Get('code/:code')
  @RequirePermission('system:configure')
  getByCode(@Param('code') code: string) {
    return this.applications.getByCode(code);
  }

  @Get(':id/revisions')
  @RequirePermission('system:configure')
  listRevisions(@Param('id', ParseUUIDPipe) id: string) {
    return this.applications.listRevisions(id);
  }

  @Post()
  @Roles('admin')
  @RequirePermission('system:configure')
  create(
    @Body() dto: CreateApplicationDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.applications.create(dto, user?.id);
  }

  @Patch(':id')
  @Roles('admin')
  @RequirePermission('system:configure')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateApplicationDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.applications.update(id, dto, user?.id);
  }

  @Post(':id/publish')
  @Roles('admin')
  @RequirePermission('system:configure')
  publish(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.applications.publish(id, user?.id);
  }

  @Post(':id/deprecate')
  @Roles('admin')
  @RequirePermission('system:configure')
  deprecate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.applications.deprecate(id, user?.id);
  }
}
