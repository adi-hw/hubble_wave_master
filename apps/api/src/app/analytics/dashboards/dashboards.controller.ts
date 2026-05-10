import { Body, Controller, Get, Param, Put, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, InstanceRequest, extractContext, Roles, RolesGuard } from '@hubblewave/auth-guard';
import { DashboardsService, DashboardDefinitionInput } from './dashboards.service';

@Controller('insights/dashboards')
@UseGuards(JwtAuthGuard, RolesGuard)
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
  @Roles('admin')
  async create(@Body() body: DashboardDefinitionInput, @Req() req?: InstanceRequest) {
    const context = extractContext(req || {});
    return this.dashboards.create(context, body);
  }

  @Put(':code')
  @Roles('admin')
  async update(
    @Param('code') code: string,
    @Body() body: Partial<DashboardDefinitionInput>,
    @Req() req?: InstanceRequest,
  ) {
    const context = extractContext(req || {});
    return this.dashboards.update(context, code, body);
  }
}
