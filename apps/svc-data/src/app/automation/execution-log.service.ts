/**
 * ExecutionLogService
 * HubbleWave Platform - Phase 3
 *
 * Service for logging automation execution results to database.
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { AutomationExecutionLog, ExecutionStatus } from '@hubblewave/instance-db';

export { ExecutionStatus };
export type AutomationType = 'data' | 'scheduled';

interface LogOptions {
  automationId?: string;
  scheduledJobId?: string;
  automationType: AutomationType;
  automationName: string;
  collectionId?: string;
  recordId?: string;
  triggerEvent?: string;
  triggerTiming?: string;
  status: ExecutionStatus;
  skippedReason?: string;
  errorMessage?: string;
  errorStack?: string;
  inputData?: Record<string, unknown>;
  outputData?: Record<string, unknown>;
  actionsExecuted?: Record<string, unknown>[];
  triggeredBy?: string;
  executionDepth?: number;
  durationMs?: number;
}

interface ExecutionLogQuery {
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

@Injectable()
export class ExecutionLogService {
  private readonly logger = new Logger(ExecutionLogService.name);

  constructor(
    @InjectRepository(AutomationExecutionLog)
    private readonly logRepo: Repository<AutomationExecutionLog>,
  ) {}

  /**
   * Log automation execution result
   */
  async log(options: LogOptions): Promise<AutomationExecutionLog> {
    const logEntry = this.logRepo.create({
      automationRuleId: options.automationId,
      scheduledJobId: options.scheduledJobId,
      automationType: options.automationType,
      automationName: options.automationName,
      collectionId: options.collectionId,
      recordId: options.recordId,
      triggerEvent: options.triggerEvent,
      triggerTiming: options.triggerTiming,
      status: options.status,
      skippedReason: options.skippedReason,
      errorMessage: options.errorMessage,
      errorStack: options.errorStack,
      inputData: options.inputData,
      outputData: options.outputData,
      actionsExecuted: options.actionsExecuted,
      triggeredBy: options.triggeredBy,
      executionDepth: options.executionDepth ?? 1,
      durationMs: options.durationMs,
    });

    const saved = await this.logRepo.save(logEntry);

    if (options.status === 'error') {
      this.logger.error(
        `Automation execution failed: ${options.automationName}`,
        {
          automationId: options.automationId,
          collectionId: options.collectionId,
          recordId: options.recordId,
          errorMessage: options.errorMessage,
          durationMs: options.durationMs,
        },
      );
    }

    return saved;
  }

  /**
   * Query execution logs
   */
  async queryLogs(query: ExecutionLogQuery): Promise<{
    data: AutomationExecutionLog[];
    total: number;
    meta: { limit: number; offset: number };
  }> {
    const qb = this.logRepo.createQueryBuilder('log');

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

  /**
   * Get execution log by ID
   */
  async getLogById(logId: string): Promise<AutomationExecutionLog | null> {
    return this.logRepo.findOne({ where: { id: logId } });
  }

  /**
   * Get recent logs for an automation
   */
  async getRecentLogs(
    automationId: string,
    limit = 10,
  ): Promise<AutomationExecutionLog[]> {
    return this.logRepo.find({
      where: { automationRuleId: automationId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  /**
   * Get execution statistics for an automation
   */
  async getExecutionStats(automationId: string, days = 7): Promise<{
    totalExecutions: number;
    successCount: number;
    errorCount: number;
    skippedCount: number;
    avgDurationMs: number;
  }> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const stats = await this.logRepo
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

  /**
   * Cleanup old logs
   */
  async cleanupOldLogs(daysToKeep = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await this.logRepo.delete({
      createdAt: LessThan(cutoffDate),
    });

    const deleted = result.affected ?? 0;
    if (deleted > 0) {
      this.logger.log(`Cleaned up ${deleted} old automation execution logs`);
    }

    return deleted;
  }
}
