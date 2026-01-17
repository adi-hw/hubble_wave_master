import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, MoreThanOrEqual, Between } from 'typeorm';
import { AnalyticsEvent, AggregatedMetric } from './analytics-entities';

export interface TrackEventRequest {
  userId?: string;
  eventType: string;
  eventCategory?: string;
  eventAction?: string;
  eventLabel?: string;
  eventValue?: number;
  collectionId?: string;
  recordId?: string;
  moduleId?: string;
  dashboardId?: string;
  metadata?: Record<string, unknown>;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  pageUrl?: string;
  referrer?: string;
}

export interface QueryMetricsRequest {
  metricCodes: string[];
  periodType: 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly';
  startDate: Date;
  endDate: Date;
  collectionId?: string;
  moduleId?: string;
  dimensions?: Record<string, string>;
}

export interface MetricResult {
  metricCode: string;
  periodStart: Date;
  periodEnd: Date;
  value: number;
  previousValue?: number;
  changePercent?: number;
  dimensions?: Record<string, string>;
}

export interface DashboardDataRequest {
  dashboardId: string;
  parameters?: Record<string, unknown>;
}

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    @InjectRepository(AnalyticsEvent)
    private readonly eventRepo: Repository<AnalyticsEvent>,
    @InjectRepository(AggregatedMetric)
    private readonly metricRepo: Repository<AggregatedMetric>,
    private readonly eventEmitter: EventEmitter2
  ) {}

  /**
   * Track an analytics event
   */
  async trackEvent(request: TrackEventRequest): Promise<void> {
    try {
      const event = this.eventRepo.create({
        userId: request.userId,
        eventType: request.eventType,
        eventCategory: request.eventCategory,
        eventAction: request.eventAction,
        eventLabel: request.eventLabel,
        eventValue: request.eventValue,
        collectionId: request.collectionId,
        recordId: request.recordId,
        moduleId: request.moduleId,
        dashboardId: request.dashboardId,
        metadata: request.metadata,
        sessionId: request.sessionId,
        ipAddress: request.ipAddress,
        userAgent: request.userAgent,
        pageUrl: request.pageUrl,
        referrer: request.referrer,
        timestamp: new Date(),
      });

      await this.eventRepo.save(event);

      // Emit event for real-time processing
      this.eventEmitter.emit('analytics.event', {
        event,
      });
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error(`Failed to track event: ${err.message}`, err.stack);
    }
  }

  /**
   * Query aggregated metrics
   */
  async queryMetrics(request: QueryMetricsRequest): Promise<MetricResult[]> {
    const whereConditions: Record<string, unknown> = {
      metricCode: request.metricCodes.length === 1 ? request.metricCodes[0] : undefined,
      periodType: request.periodType,
      periodStart: MoreThanOrEqual(request.startDate),
      periodEnd: LessThanOrEqual(request.endDate),
    };

    if (request.collectionId) {
      whereConditions['collectionId'] = request.collectionId;
    }

    if (request.moduleId) {
      whereConditions['moduleId'] = request.moduleId;
    }

    const metrics = await this.metricRepo.find({
      where: whereConditions,
      order: { periodStart: 'ASC' },
    });

    return metrics
      .filter((m) => request.metricCodes.includes(m.metricCode))
      .map((m) => ({
        metricCode: m.metricCode,
        periodStart: m.periodStart,
        periodEnd: m.periodEnd,
        value: m.value,
        previousValue: m.previousValue ?? undefined,
        changePercent: m.changePercent ?? undefined,
        dimensions: m.dimensions ?? undefined,
      }));
  }

  /**
   * Get summary metrics for a dashboard
   */
  async getDashboardSummary(
    period: 'today' | 'week' | 'month' | 'quarter' | 'year'
  ): Promise<DashboardSummary> {
    const now = new Date();
    const startDate = this.getPeriodStartDate(now, period);

    // Get basic counts
    const [
      totalEvents,
      uniqueUsers,
      pageViews,
      recordCreates,
      recordUpdates,
    ] = await Promise.all([
      this.eventRepo.count({
        where: {
          timestamp: Between(startDate, now),
        },
      }),
      this.eventRepo
        .createQueryBuilder('e')
        .select('COUNT(DISTINCT e.userId)', 'count')
        .where('e.timestamp BETWEEN :start AND :end', { start: startDate, end: now })
        .andWhere('e.userId IS NOT NULL')
        .getRawOne()
        .then((r: { count: string } | undefined) => parseInt(r?.count || '0', 10)),
      this.eventRepo.count({
        where: {
          eventType: 'page_view',
          timestamp: Between(startDate, now),
        },
      }),
      this.eventRepo.count({
        where: {
          eventType: 'record_create',
          timestamp: Between(startDate, now),
        },
      }),
      this.eventRepo.count({
        where: {
          eventType: 'record_update',
          timestamp: Between(startDate, now),
        },
      }),
    ]);

    // Get top collections
    const topCollections = await this.eventRepo
      .createQueryBuilder('e')
      .select('e.collectionId', 'collectionId')
      .addSelect('COUNT(*)', 'count')
      .where('e.timestamp BETWEEN :start AND :end', { start: startDate, end: now })
      .andWhere('e.collectionId IS NOT NULL')
      .groupBy('e.collectionId')
      .orderBy('count', 'DESC')
      .limit(5)
      .getRawMany();

    // Get top users
    const topUsers = await this.eventRepo
      .createQueryBuilder('e')
      .select('e.userId', 'userId')
      .addSelect('COUNT(*)', 'count')
      .where('e.timestamp BETWEEN :start AND :end', { start: startDate, end: now })
      .andWhere('e.userId IS NOT NULL')
      .groupBy('e.userId')
      .orderBy('count', 'DESC')
      .limit(5)
      .getRawMany();

    return {
      period,
      startDate,
      endDate: now,
      totalEvents,
      uniqueUsers,
      pageViews,
      recordCreates,
      recordUpdates,
      topCollections: topCollections.map((tc) => ({
        collectionId: tc.collectionId as string,
        count: parseInt(tc.count as string, 10),
      })),
      topUsers: topUsers.map((tu) => ({
        userId: tu.userId as string,
        count: parseInt(tu.count as string, 10),
      })),
    };
  }

  /**
   * Get time series data for a metric
   */
  async getTimeSeries(
    eventType: string,
    granularity: 'hour' | 'day' | 'week' | 'month',
    startDate: Date,
    endDate: Date
  ): Promise<TimeSeriesPoint[]> {
    let dateTrunc: string;

    switch (granularity) {
      case 'hour':
        dateTrunc = 'hour';
        break;
      case 'day':
        dateTrunc = 'day';
        break;
      case 'week':
        dateTrunc = 'week';
        break;
      case 'month':
        dateTrunc = 'month';
        break;
    }

    const result = await this.eventRepo
      .createQueryBuilder('e')
      .select(`DATE_TRUNC('${dateTrunc}', e.timestamp)`, 'period')
      .addSelect('COUNT(*)', 'count')
      .where('e.event_type = :eventType', { eventType })
      .andWhere('e.timestamp BETWEEN :start AND :end', { start: startDate, end: endDate })
      .groupBy('period')
      .orderBy('period', 'ASC')
      .getRawMany();

    return result.map((r) => ({
      timestamp: new Date(r.period as string),
      value: parseInt(r.count as string, 10),
    }));
  }

  /**
   * Aggregate metrics for a period (called by scheduler)
   */
  async aggregateMetrics(
    periodType: 'hourly' | 'daily' | 'weekly' | 'monthly',
    periodStart: Date
  ): Promise<void> {
    const periodEnd = this.getPeriodEnd(periodStart, periodType);

    // Define metrics to aggregate
    const metricDefinitions = [
      { code: 'events_total', eventType: null },
      { code: 'page_views', eventType: 'page_view' },
      { code: 'record_creates', eventType: 'record_create' },
      { code: 'record_updates', eventType: 'record_update' },
      { code: 'record_deletes', eventType: 'record_delete' },
      { code: 'logins', eventType: 'login' },
      { code: 'search_queries', eventType: 'search' },
    ];

    for (const metric of metricDefinitions) {
      const whereConditions: Record<string, unknown> = {
        timestamp: Between(periodStart, periodEnd),
      };

      if (metric.eventType) {
        whereConditions['eventType'] = metric.eventType;
      }

      const count = await this.eventRepo.count({ where: whereConditions });

      // Get previous period value for change calculation
      const previousPeriodStart = this.getPreviousPeriodStart(periodStart, periodType);
      const previousPeriodEnd = periodStart;

      const previousWhereConditions: Record<string, unknown> = {
        timestamp: Between(previousPeriodStart, previousPeriodEnd),
      };

      if (metric.eventType) {
        previousWhereConditions['eventType'] = metric.eventType;
      }

      const previousCount = await this.eventRepo.count({ where: previousWhereConditions });

      const changePercent = previousCount > 0
        ? ((count - previousCount) / previousCount) * 100
        : count > 0 ? 100 : 0;

      // Upsert metric
      const existingMetric = await this.metricRepo.findOne({
        where: {
          metricCode: metric.code,
          periodType,
          periodStart,
        },
      });

      if (existingMetric) {
        existingMetric.value = count;
        existingMetric.previousValue = previousCount;
        existingMetric.changePercent = changePercent;
        existingMetric.sampleCount += 1;
        await this.metricRepo.save(existingMetric);
      } else {
        const newMetric = this.metricRepo.create({
          metricCode: metric.code,
          periodType,
          periodStart,
          periodEnd,
          value: count,
          previousValue: previousCount,
          changePercent,
          sampleCount: 1,
        });
        await this.metricRepo.save(newMetric);
      }
    }

    this.logger.log(`Aggregated ${periodType} metrics`);
  }

  // ============ Helper Methods ============

  private getPeriodStartDate(now: Date, period: string): Date {
    const date = new Date(now);
    switch (period) {
      case 'today':
        date.setHours(0, 0, 0, 0);
        break;
      case 'week':
        date.setDate(date.getDate() - 7);
        break;
      case 'month':
        date.setMonth(date.getMonth() - 1);
        break;
      case 'quarter':
        date.setMonth(date.getMonth() - 3);
        break;
      case 'year':
        date.setFullYear(date.getFullYear() - 1);
        break;
    }
    return date;
  }

  private getPeriodEnd(start: Date, periodType: string): Date {
    const end = new Date(start);
    switch (periodType) {
      case 'hourly':
        end.setHours(end.getHours() + 1);
        break;
      case 'daily':
        end.setDate(end.getDate() + 1);
        break;
      case 'weekly':
        end.setDate(end.getDate() + 7);
        break;
      case 'monthly':
        end.setMonth(end.getMonth() + 1);
        break;
    }
    return end;
  }

  private getPreviousPeriodStart(current: Date, periodType: string): Date {
    const prev = new Date(current);
    switch (periodType) {
      case 'hourly':
        prev.setHours(prev.getHours() - 1);
        break;
      case 'daily':
        prev.setDate(prev.getDate() - 1);
        break;
      case 'weekly':
        prev.setDate(prev.getDate() - 7);
        break;
      case 'monthly':
        prev.setMonth(prev.getMonth() - 1);
        break;
    }
    return prev;
  }

  // ============ Event Handlers ============

  @OnEvent('record.created')
  async handleRecordCreated(payload: { userId?: string; collectionId: string; recordId: string }): Promise<void> {
    await this.trackEvent({
      userId: payload.userId,
      eventType: 'record_create',
      eventCategory: 'data',
      eventAction: 'create',
      collectionId: payload.collectionId,
      recordId: payload.recordId,
    });
  }

  @OnEvent('record.updated')
  async handleRecordUpdated(payload: { userId?: string; collectionId: string; recordId: string }): Promise<void> {
    await this.trackEvent({
      userId: payload.userId,
      eventType: 'record_update',
      eventCategory: 'data',
      eventAction: 'update',
      collectionId: payload.collectionId,
      recordId: payload.recordId,
    });
  }

  @OnEvent('record.deleted')
  async handleRecordDeleted(payload: { userId?: string; collectionId: string; recordId: string }): Promise<void> {
    await this.trackEvent({
      userId: payload.userId,
      eventType: 'record_delete',
      eventCategory: 'data',
      eventAction: 'delete',
      collectionId: payload.collectionId,
      recordId: payload.recordId,
    });
  }

  @OnEvent('page.viewed')
  async handlePageViewed(payload: { userId?: string; pageUrl: string; sessionId?: string }): Promise<void> {
    await this.trackEvent({
      userId: payload.userId,
      eventType: 'page_view',
      eventCategory: 'navigation',
      eventAction: 'view',
      pageUrl: payload.pageUrl,
      sessionId: payload.sessionId,
    });
  }

  @OnEvent('user.login')
  async handleUserLogin(payload: { userId: string; ipAddress?: string; userAgent?: string }): Promise<void> {
    await this.trackEvent({
      userId: payload.userId,
      eventType: 'login',
      eventCategory: 'auth',
      eventAction: 'login',
      ipAddress: payload.ipAddress,
      userAgent: payload.userAgent,
    });
  }
}

// Types
export interface DashboardSummary {
  period: string;
  startDate: Date;
  endDate: Date;
  totalEvents: number;
  uniqueUsers: number;
  pageViews: number;
  recordCreates: number;
  recordUpdates: number;
  topCollections: { collectionId: string; count: number }[];
  topUsers: { userId: string; count: number }[];
}

export interface TimeSeriesPoint {
  timestamp: Date;
  value: number;
}
