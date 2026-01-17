import { Injectable, Logger } from '@nestjs/common';
import { DataSource, Between, LessThan } from 'typeorm';
import * as crypto from 'crypto';
import {
  AuditConfig,
  AuditEntry,
  AuditEventCategory,
  AuditSeverity,
} from '@hubblewave/instance-db';

export interface AuditEventInput {
  category: AuditEventCategory;
  severity?: AuditSeverity;
  action: string;
  description?: string;
  userId?: string;
  userEmail?: string;
  userDisplayName?: string;
  actorType?: string;
  sessionId?: string;
  ssoSessionId?: string;
  resourceType?: string;
  resourceId?: string;
  resourceName?: string;
  previousValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  changedProperties?: string[];
  ipAddress?: string;
  userAgent?: string;
  httpMethod?: string;
  requestPath?: string;
  responseStatus?: number;
  durationMs?: number;
  correlationId?: string;
  parentEventId?: string;
  complianceFrameworks?: string[];
  containsPii?: boolean;
  dataClassification?: {
    level: 'public' | 'internal' | 'confidential' | 'restricted';
    categories?: string[];
  };
  metadata?: Record<string, unknown>;
  errorMessage?: string;
  stackTrace?: string;
}

export interface AuditQueryOptions {
  categories?: AuditEventCategory[];
  severities?: AuditSeverity[];
  actions?: string[];
  userIds?: string[];
  resourceTypes?: string[];
  resourceIds?: string[];
  startDate?: Date;
  endDate?: Date;
  correlationId?: string;
  containsPii?: boolean;
  limit?: number;
  offset?: number;
  orderBy?: 'createdAt' | 'severity';
  orderDirection?: 'ASC' | 'DESC';
}

export interface AuditStats {
  totalEvents: number;
  byCategory: Record<string, number>;
  bySeverity: Record<string, number>;
  byAction: Record<string, number>;
  topUsers: Array<{ userId: string; email: string; count: number }>;
  eventsTrend: Array<{ date: string; count: number }>;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  /**
   * Log an audit event
   */
  async log(
    dataSource: DataSource,
    event: AuditEventInput
  ): Promise<AuditEntry> {
    const repo = dataSource.getRepository(AuditEntry);

    // Get audit config to check if this event should be logged
    const config = await this.getActiveConfig(dataSource);
    if (config) {
      // Check if category is enabled
      if (
        config.enabledCategories.length > 0 &&
        !config.enabledCategories.includes(event.category)
      ) {
        this.logger.debug(`Audit event skipped: category ${event.category} not enabled`);
        return null as unknown as AuditEntry;
      }

      // Check severity threshold
      const severityOrder = ['info', 'warning', 'critical', 'security'];
      const eventSeverityIndex = severityOrder.indexOf(event.severity || 'info');
      const thresholdIndex = severityOrder.indexOf(config.severityThreshold);
      if (eventSeverityIndex < thresholdIndex) {
        this.logger.debug(`Audit event skipped: severity below threshold`);
        return null as unknown as AuditEntry;
      }

      // Apply PII masking if enabled
      if (config.maskPii && event.containsPii) {
        event = this.maskPiiInEvent(event, config.piiFields || []);
      }
    }

    // Generate checksum for integrity
    const checksum = this.generateChecksum(event);

    const entry = repo.create({
      ...event,
      severity: event.severity || 'info',
      checksum,
    });

    const savedEntry = await repo.save(entry);

    // Trigger alerts if configured
    if (config?.alertingEnabled) {
      await this.checkAlertRules(dataSource, config, savedEntry);
    }

    return savedEntry;
  }

  /**
   * Query audit logs
   */
  async query(
    dataSource: DataSource,
    options: AuditQueryOptions
  ): Promise<{ entries: AuditEntry[]; total: number }> {
    const repo = dataSource.getRepository(AuditEntry);
    const qb = repo.createQueryBuilder('audit');

    if (options.categories?.length) {
      qb.andWhere('audit.category IN (:...categories)', {
        categories: options.categories,
      });
    }

    if (options.severities?.length) {
      qb.andWhere('audit.severity IN (:...severities)', {
        severities: options.severities,
      });
    }

    if (options.actions?.length) {
      qb.andWhere('audit.action IN (:...actions)', {
        actions: options.actions,
      });
    }

    if (options.userIds?.length) {
      qb.andWhere('audit.userId IN (:...userIds)', {
        userIds: options.userIds,
      });
    }

    if (options.resourceTypes?.length) {
      qb.andWhere('audit.resourceType IN (:...resourceTypes)', {
        resourceTypes: options.resourceTypes,
      });
    }

    if (options.resourceIds?.length) {
      qb.andWhere('audit.resourceId IN (:...resourceIds)', {
        resourceIds: options.resourceIds,
      });
    }

    if (options.startDate) {
      qb.andWhere('audit.createdAt >= :startDate', {
        startDate: options.startDate,
      });
    }

    if (options.endDate) {
      qb.andWhere('audit.createdAt <= :endDate', {
        endDate: options.endDate,
      });
    }

    if (options.correlationId) {
      qb.andWhere('audit.correlationId = :correlationId', {
        correlationId: options.correlationId,
      });
    }

    if (options.containsPii !== undefined) {
      qb.andWhere('audit.containsPii = :containsPii', {
        containsPii: options.containsPii,
      });
    }

    const orderBy = options.orderBy || 'createdAt';
    const orderDirection = options.orderDirection || 'DESC';
    qb.orderBy(`audit.${orderBy}`, orderDirection);

    const total = await qb.getCount();

    if (options.offset) {
      qb.skip(options.offset);
    }

    if (options.limit) {
      qb.take(options.limit);
    }

    const entries = await qb.getMany();

    return { entries, total };
  }

  /**
   * Get audit statistics
   */
  async getStats(
    dataSource: DataSource,
    startDate: Date,
    endDate: Date
  ): Promise<AuditStats> {
    const repo = dataSource.getRepository(AuditEntry);

    // Total events
    const totalEvents = await repo.count({
      where: { createdAt: Between(startDate, endDate) },
    });

    // By category
    const categoryStats = await repo
      .createQueryBuilder('audit')
      .select('audit.category', 'category')
      .addSelect('COUNT(*)', 'count')
      .where('audit.createdAt BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      })
      .groupBy('audit.category')
      .getRawMany();

    // By severity
    const severityStats = await repo
      .createQueryBuilder('audit')
      .select('audit.severity', 'severity')
      .addSelect('COUNT(*)', 'count')
      .where('audit.createdAt BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      })
      .groupBy('audit.severity')
      .getRawMany();

    // By action (top 10)
    const actionStats = await repo
      .createQueryBuilder('audit')
      .select('audit.action', 'action')
      .addSelect('COUNT(*)', 'count')
      .where('audit.createdAt BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      })
      .groupBy('audit.action')
      .orderBy('count', 'DESC')
      .limit(10)
      .getRawMany();

    // Top users
    const topUsers = await repo
      .createQueryBuilder('audit')
      .select('audit.userId', 'userId')
      .addSelect('audit.userEmail', 'email')
      .addSelect('COUNT(*)', 'count')
      .where('audit.createdAt BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      })
      .andWhere('audit.userId IS NOT NULL')
      .groupBy('audit.userId')
      .addGroupBy('audit.userEmail')
      .orderBy('count', 'DESC')
      .limit(10)
      .getRawMany();

    // Events trend (daily)
    const trend = await repo
      .createQueryBuilder('audit')
      .select("DATE(audit.createdAt)", 'date')
      .addSelect('COUNT(*)', 'count')
      .where('audit.createdAt BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      })
      .groupBy("DATE(audit.createdAt)")
      .orderBy('date', 'ASC')
      .getRawMany();

    return {
      totalEvents,
      byCategory: Object.fromEntries(
        categoryStats.map((s) => [s['category'], parseInt(s['count'])])
      ),
      bySeverity: Object.fromEntries(
        severityStats.map((s) => [s['severity'], parseInt(s['count'])])
      ),
      byAction: Object.fromEntries(
        actionStats.map((s) => [s['action'], parseInt(s['count'])])
      ),
      topUsers: topUsers.map((u) => ({
        userId: u['userId'],
        email: u['email'],
        count: parseInt(u['count']),
      })),
      eventsTrend: trend.map((t) => ({
        date: t['date'],
        count: parseInt(t['count']),
      })),
    };
  }

  /**
   * Apply retention policy - archive or delete old entries
   */
  async applyRetention(dataSource: DataSource): Promise<{
    archived: number;
    deleted: number;
  }> {
    const config = await this.getActiveConfig(dataSource);
    if (!config) {
      return { archived: 0, deleted: 0 };
    }

    const repo = dataSource.getRepository(AuditEntry);
    let archived = 0;
    let deleted = 0;

    // Archive entries if enabled
    if (config.archiveEnabled && config.archiveAfterDays) {
      const archiveDate = new Date();
      archiveDate.setDate(archiveDate.getDate() - config.archiveAfterDays);

      const result = await repo.update(
        {
          createdAt: LessThan(archiveDate),
          isArchived: false,
        },
        {
          isArchived: true,
          archivedAt: new Date(),
        }
      );
      archived = result.affected ?? 0;
    }

    // Delete entries past retention period
    const deleteDate = new Date();
    deleteDate.setDate(deleteDate.getDate() - config.retentionDays);

    const deleteResult = await repo.delete({
      createdAt: LessThan(deleteDate),
      isArchived: true,
    });
    deleted = deleteResult.affected ?? 0;

    this.logger.log(`Retention applied: ${archived} archived, ${deleted} deleted`);
    return { archived, deleted };
  }

  /**
   * Get active audit configuration
   */
  async getActiveConfig(dataSource: DataSource): Promise<AuditConfig | null> {
    const repo = dataSource.getRepository(AuditConfig);
    return repo.findOne({ where: { isActive: true } });
  }

  /**
   * Get or create default audit configuration
   */
  async ensureConfig(dataSource: DataSource): Promise<AuditConfig> {
    const repo = dataSource.getRepository(AuditConfig);
    let config = await repo.findOne({ where: { isActive: true } });

    if (!config) {
      config = repo.create({
        name: 'Default Audit Configuration',
        isActive: true,
        enabledCategories: [
          'authentication',
          'authorization',
          'data_modification',
          'configuration',
          'security',
        ],
        severityThreshold: 'info',
        retentionDays: 90,
        maskPii: true,
      });
      await repo.save(config);
    }

    return config;
  }

  /**
   * Generate checksum for audit entry integrity
   */
  private generateChecksum(event: AuditEventInput): string {
    const data = JSON.stringify({
      category: event.category,
      action: event.action,
      userId: event.userId,
      resourceType: event.resourceType,
      resourceId: event.resourceId,
      timestamp: new Date().toISOString(),
    });
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Mask PII fields in audit event
   */
  private maskPiiInEvent(
    event: AuditEventInput,
    piiFields: string[]
  ): AuditEventInput {
    const mask = (value: string): string => {
      if (!value || value.length <= 4) return '****';
      return value.substring(0, 2) + '****' + value.substring(value.length - 2);
    };

    const masked = { ...event };

    if (masked.userEmail && piiFields.includes('email')) {
      masked.userEmail = mask(masked.userEmail);
    }

    if (masked.metadata) {
      masked.metadata = this.maskObjectPii(masked.metadata, piiFields);
    }

    if (masked.previousValues) {
      masked.previousValues = this.maskObjectPii(masked.previousValues, piiFields);
    }

    if (masked.newValues) {
      masked.newValues = this.maskObjectPii(masked.newValues, piiFields);
    }

    return masked;
  }

  /**
   * Recursively mask PII in an object
   */
  private maskObjectPii(
    obj: Record<string, unknown>,
    piiFields: string[]
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      if (piiFields.some((f) => key.toLowerCase().includes(f.toLowerCase()))) {
        result[key] = typeof value === 'string' ? '****' : value;
      } else if (value && typeof value === 'object' && !Array.isArray(value)) {
        result[key] = this.maskObjectPii(value as Record<string, unknown>, piiFields);
      } else {
        result[key] = value;
      }
    }

    return result;
  }

  /**
   * Check alert rules and trigger notifications
   */
  private async checkAlertRules(
    _dataSource: DataSource,
    config: AuditConfig,
    entry: AuditEntry
  ): Promise<void> {
    for (const rule of config.alertRules) {
      if (!rule.enabled) continue;

      const condition = rule.condition;
      let matches = true;

      if (condition.category && condition.category !== entry.category) {
        matches = false;
      }

      if (condition.severity && condition.severity !== entry.severity) {
        matches = false;
      }

      if (condition.action && condition.action !== entry.action) {
        matches = false;
      }

      if (matches) {
        this.logger.warn(`Alert triggered: ${rule.name} for event ${entry.id}`);
      }
    }
  }
}
