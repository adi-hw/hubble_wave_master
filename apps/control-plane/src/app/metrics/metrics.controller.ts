import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import { IngestMetricsDto } from './metrics.dto';
import { InstancesService } from '../instances/instances.service';
import { RequirePermission } from '../auth/require-permission.decorator';

/**
 * Canon §28 / W2 Stream 3 — platform telemetry. Aggregated read
 * endpoints are gated by `control_plane:metrics:read`; the per-instance
 * ingest endpoint is gated by `control_plane:metrics:invoke` (an
 * instance principal pushing health + resource samples into the
 * control-plane store).
 */
@Controller('metrics')
export class MetricsController {
  constructor(
    private readonly metricsService: MetricsService,
    private readonly instancesService: InstancesService,
  ) {}

  @Get()
  @RequirePermission('control_plane:metrics:read')
  async getPlatformMetrics() {
    return this.metricsService.getPlatformMetrics();
  }

  @Get('top-instances')
  @RequirePermission('control_plane:metrics:read')
  async getTopInstancesByLoad(@Query('limit') limit?: string) {
    return this.metricsService.getTopInstancesByLoad(limit ? parseInt(limit) : 10);
  }

  @Get('activity')
  @RequirePermission('control_plane:metrics:read')
  async getRecentActivity(@Query('limit') limit?: string) {
    return this.metricsService.getRecentActivity(limit ? parseInt(limit) : 20);
  }

  @Post('ingest/:instanceId')
  @RequirePermission('control_plane:metrics:invoke')
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
