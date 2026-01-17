import { BadRequestException, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { RequestContext } from '@hubblewave/auth-guard';
import { AuthorizationService } from '@hubblewave/authorization';
import {
  CollectionDefinition,
  MetricCadence,
  MetricDefinition,
  MetricPoint,
} from '@hubblewave/instance-db';
import { MetricPointResult, MetricQueryRange } from './metrics.types';

type MetricPeriod = {
  start: Date;
  end: Date;
};

@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);
  private readonly systemContext: RequestContext = {
    userId: 'system',
    roles: ['system'],
    permissions: [],
    isAdmin: true,
  };

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @InjectRepository(MetricDefinition)
    private readonly metricRepo: Repository<MetricDefinition>,
    @InjectRepository(MetricPoint)
    private readonly pointRepo: Repository<MetricPoint>,
    @InjectRepository(CollectionDefinition)
    private readonly collectionRepo: Repository<CollectionDefinition>,
    private readonly authz: AuthorizationService,
  ) {}

  async listMetrics(context: RequestContext): Promise<MetricDefinition[]> {
    const metrics = await this.metricRepo.find({
      where: { isActive: true },
      order: { name: 'ASC' },
    });
    const allowed: MetricDefinition[] = [];
    for (const metric of metrics) {
      if (await this.canAccessMetric(context, metric)) {
        allowed.push(metric);
      }
    }
    return allowed;
  }

  async getMetricPoints(
    context: RequestContext,
    metricCode: string,
    range: MetricQueryRange,
  ): Promise<MetricPointResult[]> {
    const metric = await this.metricRepo.findOne({ where: { code: metricCode, isActive: true } });
    if (!metric) {
      throw new BadRequestException(`Metric ${metricCode} not found`);
    }

    const allowed = await this.canAccessMetric(context, metric);
    if (!allowed) {
      throw new ForbiddenException('Metric access denied');
    }

    const { start, end, limit } = this.resolveRange(metric, range);
    if (context.isAdmin) {
      const query = this.pointRepo
        .createQueryBuilder('p')
        .where('p.metricCode = :metricCode', { metricCode })
        .andWhere('p.periodStart >= :start', { start })
        .andWhere('p.periodStart < :end', { end })
        .orderBy('p.periodStart', 'ASC');

      if (limit) {
        query.take(limit);
      }

      const points = await query.getMany();
      return points.map((point) => ({
        metricCode,
        periodStart: point.periodStart.toISOString(),
        periodEnd: point.periodEnd.toISOString(),
        value: Number(point.value),
      }));
    }

    const periods = this.buildPeriods(start, end, metric.cadence);
    const results: MetricPointResult[] = [];
    for (const period of periods) {
      const value = await this.computeMetricValue(context, metric, period.start, period.end);
      results.push({
        metricCode,
        periodStart: period.start.toISOString(),
        periodEnd: period.end.toISOString(),
        value,
      });
      if (limit && results.length >= limit) {
        break;
      }
    }
    return results;
  }

  @Cron('*/15 * * * *')
  async scheduledRollup(): Promise<void> {
    await this.runRollups();
  }

  async runRollups(): Promise<void> {
    const metrics = await this.metricRepo.find({ where: { isActive: true } });
    for (const metric of metrics) {
      try {
        await this.rollupMetric(metric);
      } catch (error) {
        this.logger.error(
          `Metric rollup failed for ${metric.code}: ${(error as Error).message}`,
          (error as Error).stack,
        );
      }
    }
  }

  private async rollupMetric(metric: MetricDefinition): Promise<void> {
    const now = new Date();
    const lastCompleteStart = this.getLastCompletePeriodStart(now, metric.cadence);
    if (!lastCompleteStart) {
      return;
    }

    const latest = await this.pointRepo.findOne({
      where: { metricCode: metric.code },
      order: { periodStart: 'DESC' },
    });

    let cursor = latest
      ? this.addPeriod(latest.periodStart, metric.cadence, 1)
      : lastCompleteStart;

    while (cursor <= lastCompleteStart) {
      const periodEnd = this.addPeriod(cursor, metric.cadence, 1);
      const value = await this.computeMetricValue(this.systemContext, metric, cursor, periodEnd);
      await this.upsertPoint(metric.code, cursor, periodEnd, value);
      cursor = this.addPeriod(cursor, metric.cadence, 1);
    }

    await this.applyRetention(metric);
  }

  private async upsertPoint(
    metricCode: string,
    periodStart: Date,
    periodEnd: Date,
    value: number,
  ): Promise<void> {
    const existing = await this.pointRepo.findOne({
      where: { metricCode, periodStart },
    });
    if (existing) {
      existing.value = value;
      existing.periodEnd = periodEnd;
      await this.pointRepo.save(existing);
      return;
    }

    const created = this.pointRepo.create({
      metricCode,
      periodStart,
      periodEnd,
      value,
    });
    await this.pointRepo.save(created);
  }

  private async applyRetention(metric: MetricDefinition): Promise<void> {
    const cutoff = new Date(Date.now() - metric.retentionDays * 24 * 60 * 60 * 1000);
    await this.pointRepo
      .createQueryBuilder()
      .delete()
      .from(MetricPoint)
      .where('metric_code = :metricCode', { metricCode: metric.code })
      .andWhere('period_start < :cutoff', { cutoff })
      .execute();
  }

  private async canAccessMetric(context: RequestContext, metric: MetricDefinition): Promise<boolean> {
    if (context.isAdmin) {
      return true;
    }

    if (metric.sourceType === 'collection') {
      const collectionCode = this.readString(metric.sourceConfig, 'collection_code');
      if (!collectionCode) {
        return false;
      }
      const collection = await this.collectionRepo.findOne({ where: { code: collectionCode } });
      if (!collection) {
        return false;
      }
      try {
        await this.authz.ensureTableAccess(context, collection.tableName, 'read');
        return true;
      } catch {
        return false;
      }
    }

    if (metric.sourceType === 'analytics_event') {
      try {
        await this.authz.ensureTableAccess(context, 'analytics_events', 'read');
        return true;
      } catch {
        return false;
      }
    }

    return false;
  }

  private resolveRange(metric: MetricDefinition, range: MetricQueryRange): {
    start: Date;
    end: Date;
    limit?: number;
  } {
    const now = new Date();
    const retentionMs = metric.retentionDays * 24 * 60 * 60 * 1000;
    const start = range.start ? new Date(range.start) : new Date(now.getTime() - retentionMs);
    const end = range.end ? new Date(range.end) : now;

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new BadRequestException('Invalid metric range');
    }
    if (start >= end) {
      throw new BadRequestException('Metric range start must be before end');
    }

    const limit = range.limit && range.limit > 0 ? Math.min(range.limit, 1000) : undefined;
    return { start, end, limit };
  }

  private buildPeriods(start: Date, end: Date, cadence: MetricCadence): MetricPeriod[] {
    const alignedStart = this.alignToCadence(start, cadence);
    const periods: MetricPeriod[] = [];
    let cursor = alignedStart;
    while (cursor < end) {
      const periodEnd = this.addPeriod(cursor, cadence, 1);
      if (periodEnd > end) {
        break;
      }
      periods.push({ start: cursor, end: periodEnd });
      cursor = periodEnd;
    }
    return periods;
  }

  private getLastCompletePeriodStart(now: Date, cadence: MetricCadence): Date | null {
    const aligned = this.alignToCadence(now, cadence);
    const lastComplete = this.addPeriod(aligned, cadence, -1);
    return lastComplete < aligned ? lastComplete : null;
  }

  private alignToCadence(date: Date, cadence: MetricCadence): Date {
    const aligned = new Date(date);
    if (cadence === 'hourly') {
      aligned.setUTCMinutes(0, 0, 0);
      return aligned;
    }
    if (cadence === 'daily') {
      aligned.setUTCHours(0, 0, 0, 0);
      return aligned;
    }
    if (cadence === 'weekly') {
      aligned.setUTCHours(0, 0, 0, 0);
      const day = aligned.getUTCDay();
      const diff = (day + 6) % 7;
      aligned.setUTCDate(aligned.getUTCDate() - diff);
      return aligned;
    }
    aligned.setUTCDate(1);
    aligned.setUTCHours(0, 0, 0, 0);
    return aligned;
  }

  private addPeriod(date: Date, cadence: MetricCadence, amount: number): Date {
    const next = new Date(date);
    if (cadence === 'hourly') {
      next.setUTCHours(next.getUTCHours() + amount);
      return next;
    }
    if (cadence === 'daily') {
      next.setUTCDate(next.getUTCDate() + amount);
      return next;
    }
    if (cadence === 'weekly') {
      next.setUTCDate(next.getUTCDate() + 7 * amount);
      return next;
    }
    next.setUTCMonth(next.getUTCMonth() + amount);
    return next;
  }

  private async computeMetricValue(
    context: RequestContext,
    metric: MetricDefinition,
    start: Date,
    end: Date,
  ): Promise<number> {
    if (metric.sourceType === 'collection') {
      return this.computeCollectionMetric(context, metric, start, end);
    }
    if (metric.sourceType === 'analytics_event') {
      return this.computeAnalyticsMetric(context, metric, start, end);
    }
    throw new BadRequestException(`Unsupported metric source: ${metric.sourceType}`);
  }

  private async computeCollectionMetric(
    context: RequestContext,
    metric: MetricDefinition,
    start: Date,
    end: Date,
  ): Promise<number> {
    const collectionCode = this.readString(metric.sourceConfig, 'collection_code');
    if (!collectionCode) {
      throw new BadRequestException(`Metric ${metric.code} missing collection_code`);
    }
    const collection = await this.collectionRepo.findOne({
      where: { code: collectionCode },
      relations: ['properties'],
    });
    if (!collection) {
      throw new BadRequestException(`Collection ${collectionCode} not found`);
    }

    const timeProperty = this.readString(metric.sourceConfig, 'time_property') || 'created_at';
    const timeColumn = collection.properties?.find((prop) => prop.code === timeProperty)?.columnName || timeProperty;
    const valueProperty = this.readString(metric.sourceConfig, 'property_code');
    const valueColumn = valueProperty
      ? collection.properties?.find((prop) => prop.code === valueProperty)?.columnName
      : undefined;

    if (metric.aggregation !== 'count' && !valueColumn) {
      throw new BadRequestException(`Metric ${metric.code} missing property_code`);
    }

    await this.authz.ensureTableAccess(context, collection.tableName, 'read');
    const rowLevel = await this.authz.buildRowLevelClause(context, collection.tableName, 'read', 't');

    const aggregate = this.buildAggregationExpression(metric.aggregation, valueColumn);
    const qb = this.dataSource
      .createQueryBuilder()
      .select(aggregate, 'value')
      .from(collection.tableName, 't')
      .where(`t."${timeColumn}" >= :start`)
      .andWhere(`t."${timeColumn}" < :end`)
      .setParameters({ start, end, ...rowLevel.params });

    if (rowLevel.clauses.length) {
      qb.andWhere(rowLevel.clauses.join(' AND '));
    }

    const result = await qb.getRawOne<{ value?: string | number }>();
    return this.parseNumeric(result?.value);
  }

  private async computeAnalyticsMetric(
    context: RequestContext,
    metric: MetricDefinition,
    start: Date,
    end: Date,
  ): Promise<number> {
    await this.authz.ensureTableAccess(context, 'analytics_events', 'read');
    const rowLevel = await this.authz.buildRowLevelClause(context, 'analytics_events', 'read', 't');

    const eventType = this.readString(metric.sourceConfig, 'event_type');
    const valueField = this.readString(metric.sourceConfig, 'value_field') || 'eventValue';
    const aggregate = this.buildAggregationExpression(metric.aggregation, valueField);
    const qb = this.dataSource
      .createQueryBuilder()
      .select(aggregate, 'value')
      .from('analytics_events', 't')
      .where('t."timestamp" >= :start')
      .andWhere('t."timestamp" < :end')
      .setParameters({ start, end, ...rowLevel.params });

    if (eventType) {
      qb.andWhere('t."eventType" = :eventType').setParameters({ eventType });
    }
    if (rowLevel.clauses.length) {
      qb.andWhere(rowLevel.clauses.join(' AND '));
    }

    const result = await qb.getRawOne<{ value?: string | number }>();
    return this.parseNumeric(result?.value);
  }

  private buildAggregationExpression(
    aggregation: MetricDefinition['aggregation'],
    column?: string,
  ): string {
    if (aggregation === 'count') {
      return 'COUNT(*)::numeric';
    }
    if (!column) {
      return '0::numeric';
    }
    const col = `t."${column}"`;
    if (aggregation === 'sum') {
      return `COALESCE(SUM(${col}), 0)::numeric`;
    }
    if (aggregation === 'avg') {
      return `COALESCE(AVG(${col}), 0)::numeric`;
    }
    if (aggregation === 'min') {
      return `COALESCE(MIN(${col}), 0)::numeric`;
    }
    return `COALESCE(MAX(${col}), 0)::numeric`;
  }

  private parseNumeric(value: unknown): number {
    if (value === null || value === undefined) {
      return 0;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private readString(source: Record<string, unknown>, key: string): string | undefined {
    const value = source[key];
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
  }
}
