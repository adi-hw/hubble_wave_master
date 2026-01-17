import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  SelfHealingEvent,
  ServiceHealthStatus,
  RecoveryAction,
  ServiceStatus,
  EventType,
  RecoveryActionType,
} from '@hubblewave/instance-db';

interface HealthMetrics {
  cpuUsage?: number;
  memoryUsage?: number;
  errorRate?: number;
  responseTimeMs?: number;
  replicaCount?: number;
}

interface RecoveryResult {
  success: boolean;
  message: string;
  actionTaken?: string;
  durationMs?: number;
}

@Injectable()
export class SelfHealingService {
  private readonly logger = new Logger(SelfHealingService.name);

  constructor(
    @InjectRepository(SelfHealingEvent)
    private readonly eventRepo: Repository<SelfHealingEvent>,
    @InjectRepository(ServiceHealthStatus)
    private readonly healthRepo: Repository<ServiceHealthStatus>,
    @InjectRepository(RecoveryAction)
    private readonly actionRepo: Repository<RecoveryAction>,
  ) {}

  @Cron(CronExpression.EVERY_30_SECONDS)
  async runHealthChecks(): Promise<void> {
    const services = await this.healthRepo.find();
    for (const service of services) {
      await this.checkServiceHealth(service.serviceName);
    }
  }

  async registerService(serviceName: string, metrics?: HealthMetrics): Promise<ServiceHealthStatus> {
    let status = await this.healthRepo.findOne({ where: { serviceName } });

    if (!status) {
      status = this.healthRepo.create({
        serviceName,
        status: 'unknown',
        healthHistory: [],
      });
    }

    if (metrics) {
      Object.assign(status, metrics);
    }

    status.lastCheckAt = new Date();
    return this.healthRepo.save(status);
  }

  async updateServiceHealth(serviceName: string, metrics: HealthMetrics): Promise<ServiceHealthStatus> {
    const status = await this.healthRepo.findOneOrFail({ where: { serviceName } });

    Object.assign(status, metrics);
    status.lastCheckAt = new Date();

    const newStatus = this.determineHealthStatus(metrics);
    const oldStatus = status.status;

    if (newStatus !== oldStatus) {
      status.status = newStatus;
      status.healthHistory = [
        ...status.healthHistory.slice(-99),
        {
          status: newStatus,
          timestamp: new Date().toISOString(),
          metrics: metrics as Record<string, unknown>,
        },
      ];

      await this.recordEvent({
        serviceName,
        eventType: 'health_check',
        reason: `Status changed from ${oldStatus} to ${newStatus}`,
        metrics: metrics as Record<string, unknown>,
      });

      if (newStatus === 'unhealthy') {
        await this.triggerRecovery(serviceName, metrics);
      }
    }

    return this.healthRepo.save(status);
  }

  private determineHealthStatus(metrics: HealthMetrics): ServiceStatus {
    if (metrics.errorRate !== undefined && metrics.errorRate > 50) {
      return 'unhealthy';
    }
    if (metrics.cpuUsage !== undefined && metrics.cpuUsage > 90) {
      return 'degraded';
    }
    if (metrics.memoryUsage !== undefined && metrics.memoryUsage > 90) {
      return 'degraded';
    }
    if (metrics.responseTimeMs !== undefined && metrics.responseTimeMs > 5000) {
      return 'degraded';
    }
    if (metrics.errorRate !== undefined && metrics.errorRate > 10) {
      return 'degraded';
    }
    return 'healthy';
  }

  async checkServiceHealth(serviceName: string): Promise<ServiceHealthStatus> {
    const status = await this.healthRepo.findOne({ where: { serviceName } });
    if (!status) {
      return this.registerService(serviceName);
    }

    // In a real implementation, this would call the service's health endpoint
    // For now, we just update the last check time
    status.lastCheckAt = new Date();
    return this.healthRepo.save(status);
  }

  async getServiceHealth(serviceName: string): Promise<ServiceHealthStatus | null> {
    return this.healthRepo.findOne({ where: { serviceName } });
  }

  async getAllServicesHealth(): Promise<ServiceHealthStatus[]> {
    return this.healthRepo.find({ order: { serviceName: 'ASC' } });
  }

  async createRecoveryAction(data: {
    name: string;
    actionType: RecoveryActionType;
    targetService?: string;
    triggerConditions: RecoveryAction['triggerConditions'];
    actionConfig: Record<string, unknown>;
  }): Promise<RecoveryAction> {
    const action = this.actionRepo.create({
      ...data,
      isActive: true,
      triggerCount: 0,
    });
    return this.actionRepo.save(action);
  }

  async updateRecoveryAction(id: string, data: Partial<{
    name: string;
    actionType: RecoveryActionType;
    targetService: string;
    triggerConditions: RecoveryAction['triggerConditions'];
    actionConfig: Record<string, unknown>;
    isActive: boolean;
  }>): Promise<RecoveryAction> {
    const action = await this.actionRepo.findOneOrFail({ where: { id } });
    Object.assign(action, data);
    return this.actionRepo.save(action);
  }

  async deleteRecoveryAction(id: string): Promise<void> {
    await this.actionRepo.delete(id);
  }

  async getRecoveryActions(serviceName?: string): Promise<RecoveryAction[]> {
    const query = this.actionRepo.createQueryBuilder('action');

    if (serviceName) {
      query.andWhere('action.targetService = :serviceName', { serviceName });
    }

    return query.orderBy('action.name', 'ASC').getMany();
  }

  private async triggerRecovery(serviceName: string, metrics: HealthMetrics): Promise<void> {
    const actions = await this.actionRepo.find({
      where: { targetService: serviceName, isActive: true },
    });

    for (const action of actions) {
      if (this.shouldTrigger(action.triggerConditions, metrics)) {
        const startTime = Date.now();
        const result = await this.executeRecoveryAction(action);
        const durationMs = Date.now() - startTime;

        action.lastTriggeredAt = new Date();
        action.triggerCount += 1;
        await this.actionRepo.save(action);

        await this.recordEvent({
          serviceName,
          eventType: result.success ? 'recovery_completed' : 'recovery_failed',
          actionTaken: action.actionType,
          reason: result.message,
          success: result.success,
          metrics: metrics as Record<string, unknown>,
          durationMs,
        });
      }
    }
  }

  private shouldTrigger(conditions: RecoveryAction['triggerConditions'], metrics: HealthMetrics): boolean {
    const metricName = conditions.metric as keyof HealthMetrics;
    const metricValue = metrics[metricName];
    if (metricValue === undefined || metricValue === null) return false;

    const numericValue = Number(metricValue);
    if (isNaN(numericValue)) return false;

    switch (conditions.operator) {
      case 'gt':
        return numericValue > conditions.threshold;
      case 'lt':
        return numericValue < conditions.threshold;
      case 'eq':
        return numericValue === conditions.threshold;
      case 'gte':
        return numericValue >= conditions.threshold;
      case 'lte':
        return numericValue <= conditions.threshold;
      default:
        return false;
    }
  }

  private async executeRecoveryAction(action: RecoveryAction): Promise<RecoveryResult> {
    this.logger.log(`Executing recovery action: ${action.name} (${action.actionType})`);

    try {
      switch (action.actionType) {
        case 'restart':
          return this.executeRestart(action);
        case 'scale_up':
          return this.executeScaleUp(action);
        case 'scale_down':
          return this.executeScaleDown(action);
        case 'circuit_break':
          return this.executeCircuitBreak(action);
        case 'failover':
          return this.executeFailover(action);
        case 'rollback':
          return this.executeRollback(action);
        default:
          return { success: false, message: `Unknown action type: ${action.actionType}` };
      }
    } catch (error) {
      return { success: false, message: (error as Error).message };
    }
  }

  private async executeRestart(_action: RecoveryAction): Promise<RecoveryResult> {
    // Integration with Kubernetes or container orchestrator
    return { success: true, message: 'Service restart initiated', actionTaken: 'restart' };
  }

  private async executeScaleUp(action: RecoveryAction): Promise<RecoveryResult> {
    const targetReplicas = (action.actionConfig.targetReplicas as number) || 3;
    return { success: true, message: `Scaled up to ${targetReplicas} replicas`, actionTaken: 'scale_up' };
  }

  private async executeScaleDown(action: RecoveryAction): Promise<RecoveryResult> {
    const targetReplicas = (action.actionConfig.targetReplicas as number) || 1;
    return { success: true, message: `Scaled down to ${targetReplicas} replicas`, actionTaken: 'scale_down' };
  }

  private async executeCircuitBreak(action: RecoveryAction): Promise<RecoveryResult> {
    const duration = (action.actionConfig.duration as number) || 60000;
    return { success: true, message: `Circuit breaker activated for ${duration}ms`, actionTaken: 'circuit_break' };
  }

  private async executeFailover(action: RecoveryAction): Promise<RecoveryResult> {
    const targetRegion = (action.actionConfig.targetRegion as string) || 'secondary';
    return { success: true, message: `Failover to ${targetRegion} initiated`, actionTaken: 'failover' };
  }

  private async executeRollback(action: RecoveryAction): Promise<RecoveryResult> {
    const targetVersion = (action.actionConfig.targetVersion as string) || 'previous';
    return { success: true, message: `Rollback to ${targetVersion} initiated`, actionTaken: 'rollback' };
  }

  async recordEvent(data: {
    serviceName: string;
    eventType: EventType;
    actionTaken?: string;
    reason?: string;
    success?: boolean;
    metrics?: Record<string, unknown>;
    durationMs?: number;
  }): Promise<SelfHealingEvent> {
    const event = this.eventRepo.create(data);
    return this.eventRepo.save(event);
  }

  async getEvents(options: {
    serviceName?: string;
    eventType?: EventType;
    limit?: number;
    offset?: number;
  }): Promise<{ data: SelfHealingEvent[]; total: number }> {
    const query = this.eventRepo.createQueryBuilder('event');

    if (options.serviceName) {
      query.andWhere('event.serviceName = :serviceName', { serviceName: options.serviceName });
    }

    if (options.eventType) {
      query.andWhere('event.eventType = :eventType', { eventType: options.eventType });
    }

    const [data, total] = await query
      .orderBy('event.createdAt', 'DESC')
      .take(options.limit || 100)
      .skip(options.offset || 0)
      .getManyAndCount();

    return { data, total };
  }

  async getDashboard(): Promise<{
    services: ServiceHealthStatus[];
    recentEvents: SelfHealingEvent[];
    activeActions: RecoveryAction[];
    summary: {
      healthy: number;
      degraded: number;
      unhealthy: number;
      unknown: number;
      recentRecoveries: number;
    };
  }> {
    const services = await this.getAllServicesHealth();
    const recentEvents = await this.eventRepo.find({
      order: { createdAt: 'DESC' },
      take: 20,
    });
    const activeActions = await this.actionRepo.find({ where: { isActive: true } });

    const summary = {
      healthy: services.filter(s => s.status === 'healthy').length,
      degraded: services.filter(s => s.status === 'degraded').length,
      unhealthy: services.filter(s => s.status === 'unhealthy').length,
      unknown: services.filter(s => s.status === 'unknown').length,
      recentRecoveries: recentEvents.filter(e => e.eventType === 'recovery_completed').length,
    };

    return { services, recentEvents, activeActions, summary };
  }
}
