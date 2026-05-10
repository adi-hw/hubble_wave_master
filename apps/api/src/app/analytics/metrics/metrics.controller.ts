import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, extractContext, InstanceRequest } from '@hubblewave/auth-guard';
import { MetricsService } from './metrics.service';

@Controller('insights/metrics')
@UseGuards(JwtAuthGuard)
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get()
  async list(@Req() req?: InstanceRequest) {
    const context = extractContext(req || {});
    return this.metricsService.listMetrics(context);
  }

  @Get(':code/points')
  async points(
    @Param('code') code: string,
    @Query('start') start?: string,
    @Query('end') end?: string,
    @Query('limit') limit?: string,
    @Query('direction') direction?: string,
    @Req() req?: InstanceRequest,
  ) {
    const context = extractContext(req || {});
    const parsedLimit = limit ? parseInt(limit, 10) : undefined;
    const dir: 'asc' | 'desc' | undefined =
      direction === 'desc' ? 'desc' : direction === 'asc' ? 'asc' : undefined;
    return this.metricsService.getMetricPoints(context, code, {
      start,
      end,
      limit: Number.isFinite(parsedLimit ?? NaN) ? parsedLimit : undefined,
      direction: dir,
    });
  }
}
