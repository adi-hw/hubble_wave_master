import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { firstValueFrom, timeout, catchError } from 'rxjs';
import { Instance, InstanceHealth } from '@hubblewave/control-plane-db';
import { AuditService } from '../audit/audit.service';

/**
 * Service-level health check result
 */
export interface ServiceHealthResult {
  serviceName: string;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unreachable';
  responseTime: number;
  lastCheck: Date;
  details?: Record<string, unknown>;
  error?: string;
}

/**
 * Aggregated instance health
 */
export interface InstanceHealthResult {
  instanceId: string;
  customerCode: string;
  overallHealth: InstanceHealth;
  services: ServiceHealthResult[];
  lastCheck: Date;
  uptime?: number;
  resourceUtilization?: {
    cpu: number;
    memory: number;
    storage: number;
  };
}

/**
 * Health aggregation summary for all instances
 */
export interface HealthAggregationSummary {
  timestamp: Date;
  totalInstances: number;
  healthyInstances: number;
  degradedInstances: number;
  unhealthyInstances: number;
  unreachableInstances: number;
  averageResponseTime: number;
  instanceResults: InstanceHealthResult[];
}

@Injectable()
export class HealthAggregatorService implements OnModuleInit {
  private readonly logger = new Logger(HealthAggregatorService.name);
  private readonly healthCheckTimeout: number;
  private readonly healthCheckInterval: number;
  private isPollingEnabled = true;
  private lastAggregation: HealthAggregationSummary | null = null;

  /**
   * Services to check for each instance
   */
  private readonly serviceEndpoints = [
    { name: 'svc-identity', port: 3000, path: '/api/health' },
    { name: 'svc-data', port: 3002, path: '/api/health' },
    { name: 'svc-metadata', port: 3003, path: '/api/health' },
    { name: 'svc-ava', port: 3004, path: '/api/health' },
    { name: 'svc-automation', port: 3005, path: '/api/health' },
    { name: 'svc-view-engine', port: 3006, path: '/api/health' },
    { name: 'svc-insights', port: 3007, path: '/api/health' },
  ];

  constructor(
    @InjectRepository(Instance)
    private readonly instanceRepo: Repository<Instance>,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.healthCheckTimeout = this.configService.get<number>('HEALTH_CHECK_TIMEOUT', 5000);
    this.healthCheckInterval = this.configService.get<number>('HEALTH_CHECK_INTERVAL', 60000);
  }

  onModuleInit() {
    this.logger.log('Health Aggregator Service initialized');
    this.logger.log(`Health check timeout: ${this.healthCheckTimeout}ms`);
    this.logger.log(`Health check interval: ${this.healthCheckInterval}ms`);
  }

  /**
   * Main health check cron job - runs every minute
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async pollAllInstances() {
    if (!this.isPollingEnabled) {
      this.logger.debug('Health polling is disabled, skipping...');
      return;
    }

    this.logger.log('Starting health check aggregation for all instances...');
    const startTime = Date.now();

    try {
      const summary = await this.aggregateAllHealth();
      this.lastAggregation = summary;

      const duration = Date.now() - startTime;
      this.logger.log(
        `Health aggregation completed in ${duration}ms: ` +
        `${summary.healthyInstances} healthy, ${summary.degradedInstances} degraded, ` +
        `${summary.unhealthyInstances} unhealthy, ${summary.unreachableInstances} unreachable`
      );

      // Emit events for monitoring/alerting
      this.eventEmitter.emit('health.aggregation.completed', summary);

      // Check for critical health issues
      if (summary.unhealthyInstances > 0 || summary.unreachableInstances > 0) {
        this.eventEmitter.emit('health.critical', {
          unhealthy: summary.unhealthyInstances,
          unreachable: summary.unreachableInstances,
          instances: summary.instanceResults.filter(
            (i) => i.overallHealth === 'unhealthy' || i.overallHealth === 'unknown'
          ),
        });
      }
    } catch (error) {
      this.logger.error('Health aggregation failed', error);
    }
  }

  /**
   * Aggregate health for all active instances
   */
  async aggregateAllHealth(): Promise<HealthAggregationSummary> {
    const instances = await this.instanceRepo.find({
      where: {
        status: 'active',
        deletedAt: IsNull(),
      },
      relations: ['customer'],
    });

    this.logger.debug(`Checking health for ${instances.length} active instances`);

    const results: InstanceHealthResult[] = [];
    const responseTimesArr: number[] = [];

    // Check health in parallel with concurrency limit
    const batchSize = 10;
    for (let i = 0; i < instances.length; i += batchSize) {
      const batch = instances.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map((instance) => this.checkInstanceHealth(instance))
      );
      results.push(...batchResults);

      // Collect response times
      batchResults.forEach((r) => {
        const avgTime = r.services.reduce((sum, s) => sum + s.responseTime, 0) / r.services.length;
        if (!isNaN(avgTime)) responseTimesArr.push(avgTime);
      });
    }

    // Update instance health in database
    await this.updateInstanceHealthRecords(results);

    const summary: HealthAggregationSummary = {
      timestamp: new Date(),
      totalInstances: instances.length,
      healthyInstances: results.filter((r) => r.overallHealth === 'healthy').length,
      degradedInstances: results.filter((r) => r.overallHealth === 'degraded').length,
      unhealthyInstances: results.filter((r) => r.overallHealth === 'unhealthy').length,
      unreachableInstances: results.filter((r) => r.overallHealth === 'unknown').length,
      averageResponseTime:
        responseTimesArr.length > 0
          ? responseTimesArr.reduce((a, b) => a + b, 0) / responseTimesArr.length
          : 0,
      instanceResults: results,
    };

    return summary;
  }

  /**
   * Check health of a single instance by querying all its services
   */
  async checkInstanceHealth(instance: Instance): Promise<InstanceHealthResult> {
    const customerCode = instance.customer?.code || 'unknown';
    const baseUrl = instance.domain || `http://${instance.id}.local`;

    const serviceResults: ServiceHealthResult[] = await Promise.all(
      this.serviceEndpoints.map((endpoint) =>
        this.checkServiceHealth(baseUrl, endpoint.name, endpoint.port, endpoint.path)
      )
    );

    // Determine overall health based on service health
    const overallHealth = this.calculateOverallHealth(serviceResults);

    // Collect resource utilization from service responses
    const resourceUtilization = this.extractResourceUtilization(serviceResults);

    return {
      instanceId: instance.id,
      customerCode,
      overallHealth,
      services: serviceResults,
      lastCheck: new Date(),
      resourceUtilization,
    };
  }

  /**
   * Check health of a single service endpoint
   */
  private async checkServiceHealth(
    baseUrl: string,
    serviceName: string,
    port: number,
    path: string
  ): Promise<ServiceHealthResult> {
    const url = `${baseUrl}:${port}${path}`;
    const startTime = Date.now();

    try {
      const response = await firstValueFrom(
        this.httpService.get(url).pipe(
          timeout(this.healthCheckTimeout),
          catchError((error) => {
            throw error;
          })
        )
      );

      const responseTime = Date.now() - startTime;
      const data = response.data;

      // Determine status based on response
      let status: ServiceHealthResult['status'] = 'healthy';
      if (data?.status === 'degraded') {
        status = 'degraded';
      } else if (data?.status === 'unhealthy' || response.status >= 500) {
        status = 'unhealthy';
      }

      return {
        serviceName,
        status,
        responseTime,
        lastCheck: new Date(),
        details: data,
      };
    } catch (error: unknown) {
      const responseTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Distinguish between timeout and connection errors
      let status: ServiceHealthResult['status'] = 'unreachable';
      if (errorMessage.includes('timeout')) {
        status = 'unhealthy';
      }

      return {
        serviceName,
        status,
        responseTime,
        lastCheck: new Date(),
        error: errorMessage,
      };
    }
  }

  /**
   * Calculate overall instance health from individual service health
   */
  private calculateOverallHealth(services: ServiceHealthResult[]): InstanceHealth {
    const statusCounts = services.reduce(
      (acc, s) => {
        acc[s.status] = (acc[s.status] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const total = services.length;

    // If any service is unreachable, instance is unknown
    if (statusCounts.unreachable > 0 && statusCounts.unreachable === total) {
      return 'unknown';
    }

    // If majority of services are unhealthy, instance is unhealthy
    if ((statusCounts.unhealthy || 0) + (statusCounts.unreachable || 0) > total / 2) {
      return 'unhealthy';
    }

    // If any service is unhealthy or degraded, instance is degraded
    if (statusCounts.unhealthy || statusCounts.degraded || statusCounts.unreachable) {
      return 'degraded';
    }

    return 'healthy';
  }

  /**
   * Extract resource utilization from service health responses
   */
  private extractResourceUtilization(services: ServiceHealthResult[]): {
    cpu: number;
    memory: number;
    storage: number;
  } | undefined {
    // Try to find resource metrics in any service response
    for (const service of services) {
      if (service.details?.resources) {
        const resources = service.details.resources as Record<string, number>;
        return {
          cpu: resources.cpu || 0,
          memory: resources.memory || 0,
          storage: resources.storage || 0,
        };
      }
    }
    return undefined;
  }

  /**
   * Update instance health records in database
   */
  private async updateInstanceHealthRecords(results: InstanceHealthResult[]): Promise<void> {
    for (const result of results) {
      try {
        await this.instanceRepo.update(result.instanceId, {
          health: result.overallHealth,
          lastHealthCheck: result.lastCheck,
          healthDetails: {
            services: result.services,
            resourceUtilization: result.resourceUtilization,
          },
          resourceMetrics: result.resourceUtilization
            ? {
                cpu_usage: result.resourceUtilization.cpu,
                memory_usage: result.resourceUtilization.memory,
                disk_usage: result.resourceUtilization.storage,
              }
            : undefined,
        });

        // Log health changes (only for non-healthy states)
        if (result.overallHealth !== 'healthy') {
          await this.auditService.log(
            'instance.health.degraded',
            `Instance ${result.instanceId} health: ${result.overallHealth}`,
            {
              target: result.instanceId,
              targetType: 'instance',
              actor: 'health-aggregator',
              metadata: {
                health: result.overallHealth,
                services: result.services.map((s) => ({
                  name: s.serviceName,
                  status: s.status,
                  responseTime: s.responseTime,
                })),
              },
            }
          );
        }
      } catch (error) {
        this.logger.error(`Failed to update health for instance ${result.instanceId}`, error);
      }
    }
  }

  /**
   * Get the last aggregation result
   */
  getLastAggregation(): HealthAggregationSummary | null {
    return this.lastAggregation;
  }

  /**
   * Check health for a specific instance (on-demand)
   */
  async checkInstanceById(instanceId: string): Promise<InstanceHealthResult> {
    const instance = await this.instanceRepo.findOne({
      where: { id: instanceId, deletedAt: IsNull() },
      relations: ['customer'],
    });

    if (!instance) {
      throw new Error(`Instance ${instanceId} not found`);
    }

    const result = await this.checkInstanceHealth(instance);

    // Update database
    await this.instanceRepo.update(instanceId, {
      health: result.overallHealth,
      lastHealthCheck: result.lastCheck,
      healthDetails: {
        services: result.services,
        resourceUtilization: result.resourceUtilization,
      },
    });

    return result;
  }

  /**
   * Enable/disable health polling
   */
  setPollingEnabled(enabled: boolean): void {
    this.isPollingEnabled = enabled;
    this.logger.log(`Health polling ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Get polling status
   */
  isPollingActive(): boolean {
    return this.isPollingEnabled;
  }
}
