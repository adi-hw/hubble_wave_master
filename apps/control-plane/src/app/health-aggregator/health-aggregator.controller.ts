import {
  Controller,
  Get,
  Post,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { CurrentUser, CurrentUserData } from '../auth/current-user.decorator';
import { RequirePermission } from '../auth/require-permission.decorator';
import {
  HealthAggregatorService,
  HealthAggregationSummary,
  InstanceHealthResult,
} from './health-aggregator.service';
import { Public } from '../auth/public.decorator';

/**
 * Canon §28 / W2 Stream 3 — control-plane health aggregator. The
 * unauthenticated `/health` ping is `@Public` for load balancers /
 * Kubernetes liveness probes. Per-instance + aggregated health reads
 * are gated by `control_plane:health:read`; triggering an immediate
 * aggregation and toggling the periodic polling job are gated by
 * `control_plane:health:manage`.
 */
@ApiTags('Health')
@Controller('health')
export class HealthAggregatorController {
  constructor(private readonly healthService: HealthAggregatorService) {}

  /**
   * Public health endpoint for load balancers/K8s probes
   */
  @Public()
  @Get()
  @ApiOperation({ summary: 'Control Plane health check' })
  @ApiResponse({ status: 200, description: 'Service is healthy' })
  healthCheck() {
    return {
      status: 'healthy',
      service: 'svc-control-plane',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('instances')
  @RequirePermission('control_plane:health:read')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get aggregated health for all instances' })
  @ApiResponse({
    status: 200,
    description: 'Aggregated health summary',
  })
  async getAggregatedHealth(): Promise<HealthAggregationSummary | { message: string }> {
    const lastAggregation = this.healthService.getLastAggregation();

    if (!lastAggregation) {
      return {
        message: 'No health data available yet. Health check runs every minute.',
      };
    }

    return lastAggregation;
  }

  @Post('instances/check')
  @RequirePermission('control_plane:health:manage')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Trigger immediate health check for all instances' })
  @ApiResponse({
    status: 200,
    description: 'Health check completed',
  })
  async triggerHealthCheck(): Promise<HealthAggregationSummary> {
    return this.healthService.aggregateAllHealth();
  }

  @Get('instances/:instanceId')
  @RequirePermission('control_plane:health:read')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get health status for specific instance' })
  @ApiResponse({
    status: 200,
    description: 'Instance health details',
  })
  async getInstanceHealth(
    @Param('instanceId') instanceId: string,
    @CurrentUser() user: CurrentUserData,
  ): Promise<InstanceHealthResult> {
    return this.healthService.checkInstanceById(instanceId, {
      id: user.id,
      role: user.role,
    });
  }

  @Get('polling/status')
  @RequirePermission('control_plane:health:read')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get health polling status' })
  getPollingStatus() {
    return {
      enabled: this.healthService.isPollingActive(),
      lastCheck: this.healthService.getLastAggregation()?.timestamp || null,
    };
  }

  @Post('polling/enable')
  @RequirePermission('control_plane:health:manage')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Enable health polling' })
  enablePolling() {
    this.healthService.setPollingEnabled(true);
    return { message: 'Health polling enabled', enabled: true };
  }

  @Post('polling/disable')
  @RequirePermission('control_plane:health:manage')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Disable health polling' })
  disablePolling() {
    this.healthService.setPollingEnabled(false);
    return { message: 'Health polling disabled', enabled: false };
  }

  @Get('summary')
  @RequirePermission('control_plane:health:read')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get health summary statistics' })
  async getHealthSummary() {
    const last = this.healthService.getLastAggregation();

    if (!last) {
      return {
        status: 'no_data',
        message: 'Health aggregation has not run yet',
      };
    }

    return {
      timestamp: last.timestamp,
      total: last.totalInstances,
      healthy: last.healthyInstances,
      degraded: last.degradedInstances,
      unhealthy: last.unhealthyInstances,
      unreachable: last.unreachableInstances,
      averageResponseTime: Math.round(last.averageResponseTime),
      healthPercentage: last.totalInstances > 0
        ? Math.round((last.healthyInstances / last.totalInstances) * 100)
        : 100,
    };
  }
}
