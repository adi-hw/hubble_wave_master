import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { InstancesService } from './instances.service';
import { CreateInstanceDto, UpdateInstanceDto, InstanceQueryParams } from './instances.dto';
import { CurrentUser } from '../auth/current-user.decorator';
import { RequirePermission } from '../auth/require-permission.decorator';

/**
 * Canon §28 / W2 Stream 3 — control-plane instance registry. Reads
 * gated by `control_plane:instance:read`; provisioning, lifecycle,
 * health / metrics writes, domain binding, and termination by
 * `control_plane:instance:manage` (dangerous — bumps to admin tier).
 */
@Controller('instances')
export class InstancesController {
  constructor(private readonly instancesService: InstancesService) {}

  @Get()
  @RequirePermission('control_plane:instance:read')
  async findAll(@Query() query: InstanceQueryParams) {
    return this.instancesService.findAll(query);
  }

  @Get('stats')
  @RequirePermission('control_plane:instance:read')
  async getStats() {
    return this.instancesService.getStats();
  }

  @Get(':id')
  @RequirePermission('control_plane:instance:read')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.instancesService.findOne(id);
  }

  @Get('customer/:customerId')
  @RequirePermission('control_plane:instance:read')
  async findByCustomer(@Param('customerId', ParseUUIDPipe) customerId: string) {
    return this.instancesService.findByCustomer(customerId);
  }

  @Post()
  @RequirePermission('control_plane:instance:manage')
  async create(@Body() dto: CreateInstanceDto) {
    return this.instancesService.create(dto);
  }

  @Post(':id/provision')
  @RequirePermission('control_plane:instance:manage')
  async provision(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.instancesService.provision(id, userId);
  }

  @Put(':id')
  @RequirePermission('control_plane:instance:manage')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateInstanceDto,
  ) {
    return this.instancesService.update(id, dto);
  }

  @Patch(':id/health')
  @RequirePermission('control_plane:instance:manage')
  async updateHealth(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { health: string; details?: Record<string, unknown> },
    @CurrentUser('id') userId: string,
  ) {
    return this.instancesService.updateHealth(id, body.health as any, body.details, userId);
  }

  @Patch(':id/metrics')
  @RequirePermission('control_plane:instance:manage')
  async updateMetrics(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() metrics: Record<string, unknown>,
    @CurrentUser('id') userId: string,
  ) {
    return this.instancesService.updateMetrics(id, metrics as any, userId);
  }

  @Patch(':id/domain')
  @RequirePermission('control_plane:instance:manage')
  async setDomain(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { domain: string },
  ) {
    return this.instancesService.setDomain(id, body.domain);
  }

  @Delete(':id')
  @RequirePermission('control_plane:instance:manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  async terminate(@Param('id', ParseUUIDPipe) id: string) {
    return this.instancesService.terminate(id);
  }
}
