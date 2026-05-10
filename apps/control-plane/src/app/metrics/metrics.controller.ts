import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import { IngestMetricsDto } from './metrics.dto';
import { InstancesService } from '../instances/instances.service';

@Controller('metrics')
export class MetricsController {
  constructor(
    private readonly metricsService: MetricsService,
    private readonly instancesService: InstancesService,
  ) {}

  @Get()
  async getPlatformMetrics() {
    return this.metricsService.getPlatformMetrics();
  }

  @Get('top-instances')
  async getTopInstancesByLoad(@Query('limit') limit?: string) {
    return this.metricsService.getTopInstancesByLoad(limit ? parseInt(limit) : 10);
  }

  @Get('activity')
  async getRecentActivity(@Query('limit') limit?: string) {
    return this.metricsService.getRecentActivity(limit ? parseInt(limit) : 20);
  }

  @Post('ingest/:instanceId')
  async ingest(
    @Param('instanceId', ParseUUIDPipe) instanceId: string,
    @Body() dto: IngestMetricsDto,
  ) {
    if (dto.health) {
      await this.instancesService.updateHealth(instanceId, dto.health, dto.details ? { details: dto.details } : undefined);
    }
    if (dto.resourceMetrics) {
      await this.instancesService.updateMetrics(instanceId, dto.resourceMetrics as any);
    }
    return { status: 'ok' };
  }
}
