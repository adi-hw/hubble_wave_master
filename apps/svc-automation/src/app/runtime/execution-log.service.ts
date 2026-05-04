import { Injectable, Logger } from '@nestjs/common';
import { DataSource, EntityManager, LessThan } from 'typeorm';
import { AutomationExecutionLog, ExecutionStatus } from '@hubblewave/instance-db';
import { AutomationExecutionStatus, TriggeredByPrincipalType } from './automation-runtime.types';

export { ExecutionStatus };

export interface ExecutionLogQuery {
  automationId?: string;
  scheduledJobId?: string;
  collectionId?: string;
  recordId?: string;
  status?: ExecutionStatus;
  fromDate?: Date;
  toDate?: Date;
  limit?: number;
  offset?: number;
}

export type AutomationType = 'data' | 'scheduled';

export interface LogOptions {
  automationId?: string;
  scheduledJobId?: string;
  automationType?: AutomationType;
  automationName: string;
  collectionId?: string;
  recordId?: string;
  triggerEvent?: string;
  triggerTiming?: string;
  status: AutomationExecutionStatus;
  skippedReason?: string;
  errorMessage?: string;
  errorStack?: string;
  inputData?: Record<string, unknown>;
  outputData?: Record<string, unknown>;
  actionsExecuted?: Record<string, unknown>[];
  triggeredBy?: string | null;
  triggeredByPrincipalType?: TriggeredByPrincipalType;
  executionDepth?: number;
  durationMs?: number;
}

@Injectable()
export class ExecutionLogService {
  private readonly logger = new Logger(ExecutionLogService.name);

  constructor(private readonly dataSource: DataSource) {}

  async log(options: LogOptions, mgr?: EntityManager): Promise<AutomationExecutionLog> {
    // The execution-log entity's persisted status enum predates the
    // 'partial_failure' bucket, so we keep the rich status in outputData and
    // map it to the closest persisted value for indexing/back-compat.
    const persistedStatus =
      options.status === 'partial_failure' ? 'error' : options.status;
    const enrichedOutput: Record<string, unknown> = {
      ...(options.outputData || {}),
      _runtimeStatus: options.status,
      _triggeredByPrincipalType: options.triggeredByPrincipalType,
    };

    const repo = (mgr ?? this.dataSource).getRepository(AutomationExecutionLog);
    const entry = repo.create({
      automationRuleId: options.automationId,
      scheduledJobId: options.scheduledJobId,
      automationType: options.automationType ?? 'data',
      automationName: options.automationName,
      collectionId: options.collectionId,
      recordId: options.recordId,
      triggerEvent: options.triggerEvent,
      triggerTiming: options.triggerTiming,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      status: persistedStatus as any,
      skippedReason: options.skippedReason,
      errorMessage: options.errorMessage,
      errorStack: options.errorStack,
      inputData: options.inputData,
      outputData: enrichedOutput,
      actionsExecuted: options.actionsExecuted,
      triggeredBy: options.triggeredBy ?? undefined,
      executionDepth: options.executionDepth || 1,
      durationMs: options.durationMs,
    } as Partial<AutomationExecutionLog>);

    try {
      return await repo.save(entry);
    } catch (error) {
      this.logger.error(`Automation execution log save failed: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Query execution logs by combination of automation, scheduled job,
   * collection, record, status, and date range. Used by the rules
   * controller's read endpoints.
   */
  async queryLogs(query: ExecutionLogQuery): Promise<{
    data: AutomationExecutionLog[];
    total: number;
    meta: { limit: number; offset: number };
  }> {
    const repo = this.dataSource.getRepository(AutomationExecutionLog);
    const qb = repo.createQueryBuilder('log');

    if (query.automationId) {
      qb.andWhere('log.automation_rule_id = :automationId', {
        automationId: query.automationId,
      });
    }
    if (query.scheduledJobId) {
      qb.andWhere('log.scheduled_job_id = :scheduledJobId', {
        scheduledJobId: query.scheduledJobId,
      });
    }
    if (query.collectionId) {
      qb.andWhere('log.collection_id = :collectionId', {
        collectionId: query.collectionId,
      });
    }
    if (query.recordId) {
      qb.andWhere('log.record_id = :recordId', { recordId: query.recordId });
    }
    if (query.status) {
      qb.andWhere('log.status = :status', { status: query.status });
    }
    if (query.fromDate) {
      qb.andWhere('log.created_at >= :fromDate', { fromDate: query.fromDate });
    }
    if (query.toDate) {
      qb.andWhere('log.created_at <= :toDate', { toDate: query.toDate });
    }

    qb.orderBy('log.created_at', 'DESC');

    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;
    qb.take(limit).skip(offset);

    const [data, total] = await qb.getManyAndCount();
    return { data, total, meta: { limit, offset } };
  }

  async getLogById(logId: string): Promise<AutomationExecutionLog | null> {
    return this.dataSource
      .getRepository(AutomationExecutionLog)
      .findOne({ where: { id: logId } });
  }

  async getRecentLogs(
    automationId: string,
    limit = 10,
  ): Promise<AutomationExecutionLog[]> {
    return this.dataSource.getRepository(AutomationExecutionLog).find({
      where: { automationRuleId: automationId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async getExecutionStats(
    automationId: string,
    days = 7,
  ): Promise<{
    totalExecutions: number;
    successCount: number;
    errorCount: number;
    skippedCount: number;
    avgDurationMs: number;
  }> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const stats = await this.dataSource
      .getRepository(AutomationExecutionLog)
      .createQueryBuilder('log')
      .select([
        'COUNT(*) as total',
        "SUM(CASE WHEN log.status = 'success' THEN 1 ELSE 0 END) as success_count",
        "SUM(CASE WHEN log.status = 'error' THEN 1 ELSE 0 END) as error_count",
        "SUM(CASE WHEN log.status = 'skipped' THEN 1 ELSE 0 END) as skipped_count",
        'AVG(log.duration_ms) as avg_duration',
      ])
      .where('log.automation_rule_id = :automationId', { automationId })
      .andWhere('log.created_at >= :since', { since })
      .getRawOne();

    return {
      totalExecutions: parseInt(stats.total) || 0,
      successCount: parseInt(stats.success_count) || 0,
      errorCount: parseInt(stats.error_count) || 0,
      skippedCount: parseInt(stats.skipped_count) || 0,
      avgDurationMs: parseFloat(stats.avg_duration) || 0,
    };
  }

  async cleanupOldLogs(daysToKeep = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await this.dataSource
      .getRepository(AutomationExecutionLog)
      .delete({ createdAt: LessThan(cutoffDate) });

    const deleted = result.affected ?? 0;
    if (deleted > 0) {
      this.logger.log(`Cleaned up ${deleted} old automation execution logs`);
    }
    return deleted;
  }
}
