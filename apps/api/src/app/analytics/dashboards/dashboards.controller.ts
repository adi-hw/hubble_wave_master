import { Body, Controller, Get, Param, Put, Post, Req, UseGuards } from '@nestjs/common';
import {
  AuthenticatedOnly,
  InstanceRequest,
  JwtAuthGuard,
  PermissionsGuard,
  RequirePermission,
  extractContext,
} from '@hubblewave/auth-guard';
import { DashboardsService, DashboardDefinitionInput } from './dashboards.service';

/**
 * Canon §28 / W2 Stream 3 — dashboard viewing is user-facing
 * (Stream 4a Task 34 widget-authz filter applies inside the service).
 * Dashboard authoring (create/update) is admin: method-level
 * `@RequirePermission('metadata:workspace:manage')`.
 */
@AuthenticatedOnly()
@Controller('insights/dashboards')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DashboardsController {
  constructor(private readonly dashboards: DashboardsService) {}

  @Get()
  async list(@Req() req?: InstanceRequest) {
    const context = extractContext(req || {});
    return this.dashboards.list(context);
  }

  @Get(':code')
  async get(@Param('code') code: string, @Req() req?: InstanceRequest) {
    const context = extractContext(req || {});
    return this.dashboards.get(context, code);
  }

  @Post()
  @RequirePermission('metadata:workspace:manage')
  async create(@Body() body: DashboardDefinitionInput, @Req() req?: InstanceRequest) {
    const context = extractContext(req || {});
    return this.dashboards.create(context, body);
  }

  @Put(':code')
  @RequirePermission('metadata:workspace:manage')
  async update(
    @Param('code') code: string,
    @Body() body: Partial<DashboardDefinitionInput>,
    @Req() req?: InstanceRequest,
  ) {
    const context = extractContext(req || {});
    return this.dashboards.update(context, code, body);
  }
}
