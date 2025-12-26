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
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('instances')
@Roles('operator')
export class InstancesController {
  constructor(private readonly instancesService: InstancesService) {}

  @Get()
  async findAll(@Query() query: InstanceQueryParams) {
    return this.instancesService.findAll(query);
  }

  @Get('stats')
  async getStats() {
    return this.instancesService.getStats();
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.instancesService.findOne(id);
  }

  @Get('customer/:customerId')
  async findByCustomer(@Param('customerId', ParseUUIDPipe) customerId: string) {
    return this.instancesService.findByCustomer(customerId);
  }

  @Post()
  async create(@Body() dto: CreateInstanceDto) {
    return this.instancesService.create(dto);
  }

  @Post(':id/provision')
  async provision(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.instancesService.provision(id, userId);
  }

  @Put(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateInstanceDto,
  ) {
    return this.instancesService.update(id, dto);
  }

  @Patch(':id/health')
  async updateHealth(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { health: string; details?: Record<string, unknown> },
  ) {
    return this.instancesService.updateHealth(id, body.health as any, body.details);
  }

  @Patch(':id/metrics')
  async updateMetrics(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() metrics: Record<string, unknown>,
  ) {
    return this.instancesService.updateMetrics(id, metrics as any);
  }

  @Patch(':id/domain')
  async setDomain(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { domain: string },
  ) {
    return this.instancesService.setDomain(id, body.domain);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async terminate(@Param('id', ParseUUIDPipe) id: string) {
    return this.instancesService.terminate(id);
  }
}
