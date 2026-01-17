import {
  Controller,
  Get,
  Post,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import {
  HealthAggregatorService,
  HealthAggregationSummary,
  InstanceHealthResult,
} from './health-aggregator.service';
import { Public } from '../auth/public.decorator';

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

  /**
   * Get aggregated health status for all instances
   */
  @Get('instances')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'operator')
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

  /**
   * Trigger immediate health check for all instances
   */
  @Post('instances/check')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'operator')
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

  /**
   * Get health status for a specific instance
   */
  @Get('instances/:instanceId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'operator')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get health status for specific instance' })
  @ApiResponse({
    status: 200,
    description: 'Instance health details',
  })
  async getInstanceHealth(
    @Param('instanceId') instanceId: string
  ): Promise<InstanceHealthResult> {
    return this.healthService.checkInstanceById(instanceId);
  }

  /**
   * Get health polling status
   */
  @Get('polling/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get health polling status' })
  getPollingStatus() {
    return {
      enabled: this.healthService.isPollingActive(),
      lastCheck: this.healthService.getLastAggregation()?.timestamp || null,
    };
  }

  /**
   * Enable health polling
   */
  @Post('polling/enable')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Enable health polling' })
  enablePolling() {
    this.healthService.setPollingEnabled(true);
    return { message: 'Health polling enabled', enabled: true };
  }

  /**
   * Disable health polling
   */
  @Post('polling/disable')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Disable health polling' })
  disablePolling() {
    this.healthService.setPollingEnabled(false);
    return { message: 'Health polling disabled', enabled: false };
  }

  /**
   * Get health summary statistics
   */
  @Get('summary')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'operator')
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
