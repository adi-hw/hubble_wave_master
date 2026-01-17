import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import {
  AlertDefinition,
  DashboardDefinition,
  MetricAggregation,
  MetricCadence,
  MetricDefinition,
  MetricSourceType,
} from '@hubblewave/instance-db';

type InsightsAsset = {
  metrics?: MetricDefinitionAsset[];
  dashboards?: DashboardDefinitionAsset[];
  alerts?: AlertDefinitionAsset[];
};

type MetricDefinitionAsset = {
  code: string;
  name: string;
  description?: string;
  source_type: MetricSourceType;
  source?: Record<string, unknown>;
  aggregation: MetricAggregation;
  cadence: MetricCadence;
  retention_days?: number;
  metadata?: Record<string, unknown>;
};

type DashboardDefinitionAsset = {
  code: string;
  name: string;
  description?: string;
  layout?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

type AlertDefinitionAsset = {
  code: string;
  name: string;
  description?: string;
  conditions?: Record<string, unknown>;
  actions?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

@Injectable()
export class InsightsIngestService {
  async applyAsset(
    manager: EntityManager,
    rawAsset: unknown,
    context: { packCode: string; releaseId: string; actorId?: string; status?: 'draft' | 'published' | 'deprecated' },
  ): Promise<void> {
    const asset = this.parseAsset(rawAsset);
    const metricRepo = manager.getRepository(MetricDefinition);
    const dashboardRepo = manager.getRepository(DashboardDefinition);
    const alertRepo = manager.getRepository(AlertDefinition);

    for (const metric of asset.metrics || []) {
      const existing = await metricRepo.findOne({ where: { code: metric.code } });
      if (existing) {
        this.assertPackOwnership(existing.metadata, context.packCode, 'metric', metric.code);
        existing.name = metric.name;
        existing.description = metric.description ?? undefined;
        existing.sourceType = metric.source_type;
        existing.sourceConfig = metric.source || {};
        existing.aggregation = metric.aggregation;
        existing.cadence = metric.cadence;
        existing.retentionDays = metric.retention_days ?? existing.retentionDays;
        existing.metadata = this.mergeMetadata(metric.metadata, context, existing.metadata);
        existing.isActive = true;
        existing.updatedBy = context.actorId;
        await metricRepo.save(existing);
      } else {
        const created = metricRepo.create({
          code: metric.code,
          name: metric.name,
          description: metric.description ?? undefined,
          sourceType: metric.source_type,
          sourceConfig: metric.source || {},
          aggregation: metric.aggregation,
          cadence: metric.cadence,
          retentionDays: metric.retention_days ?? 90,
          metadata: this.mergeMetadata(metric.metadata, context),
          isActive: true,
          createdBy: context.actorId || null,
          updatedBy: context.actorId || null,
        });
        await metricRepo.save(created);
      }
    }

    for (const dashboard of asset.dashboards || []) {
      const existing = await dashboardRepo.findOne({ where: { code: dashboard.code } });
      if (existing) {
        this.assertPackOwnership(existing.metadata, context.packCode, 'dashboard', dashboard.code);
        existing.name = dashboard.name;
        existing.description = dashboard.description ?? undefined;
        existing.layout = dashboard.layout || {};
        existing.metadata = this.mergeMetadata(dashboard.metadata, context, existing.metadata);
        existing.isActive = true;
        existing.updatedBy = context.actorId;
        await dashboardRepo.save(existing);
      } else {
        const created = dashboardRepo.create({
          code: dashboard.code,
          name: dashboard.name,
          description: dashboard.description ?? undefined,
          layout: dashboard.layout || {},
          metadata: this.mergeMetadata(dashboard.metadata, context),
          isActive: true,
          createdBy: context.actorId || null,
          updatedBy: context.actorId || null,
        });
        await dashboardRepo.save(created);
      }
    }

    for (const alert of asset.alerts || []) {
      const existing = await alertRepo.findOne({ where: { code: alert.code } });
      if (existing) {
        this.assertPackOwnership(existing.metadata, context.packCode, 'alert', alert.code);
        existing.name = alert.name;
        existing.description = alert.description ?? undefined;
        existing.conditions = alert.conditions || {};
        existing.actions = alert.actions || {};
        existing.metadata = this.mergeMetadata(alert.metadata, context, existing.metadata);
        existing.isActive = true;
        existing.updatedBy = context.actorId;
        await alertRepo.save(existing);
      } else {
        const created = alertRepo.create({
          code: alert.code,
          name: alert.name,
          description: alert.description ?? undefined,
          conditions: alert.conditions || {},
          actions: alert.actions || {},
          metadata: this.mergeMetadata(alert.metadata, context),
          isActive: true,
          createdBy: context.actorId || null,
          updatedBy: context.actorId || null,
        });
        await alertRepo.save(created);
      }
    }
  }

  async deactivateAsset(
    manager: EntityManager,
    rawAsset: unknown,
    context: { packCode: string; releaseId: string; actorId?: string },
  ): Promise<void> {
    const asset = this.parseAsset(rawAsset);
    const metricRepo = manager.getRepository(MetricDefinition);
    const dashboardRepo = manager.getRepository(DashboardDefinition);
    const alertRepo = manager.getRepository(AlertDefinition);

    for (const metric of asset.metrics || []) {
      const existing = await metricRepo.findOne({ where: { code: metric.code } });
      if (!existing) continue;
      this.assertPackOwnership(existing.metadata, context.packCode, 'metric', metric.code);
      existing.isActive = false;
      existing.metadata = this.mergeMetadata(metric.metadata, { ...context, status: 'deprecated' }, existing.metadata);
      existing.updatedBy = context.actorId;
      await metricRepo.save(existing);
    }

    for (const dashboard of asset.dashboards || []) {
      const existing = await dashboardRepo.findOne({ where: { code: dashboard.code } });
      if (!existing) continue;
      this.assertPackOwnership(existing.metadata, context.packCode, 'dashboard', dashboard.code);
      existing.isActive = false;
      existing.metadata = this.mergeMetadata(dashboard.metadata, { ...context, status: 'deprecated' }, existing.metadata);
      existing.updatedBy = context.actorId;
      await dashboardRepo.save(existing);
    }

    for (const alert of asset.alerts || []) {
      const existing = await alertRepo.findOne({ where: { code: alert.code } });
      if (!existing) continue;
      this.assertPackOwnership(existing.metadata, context.packCode, 'alert', alert.code);
      existing.isActive = false;
      existing.metadata = this.mergeMetadata(alert.metadata, { ...context, status: 'deprecated' }, existing.metadata);
      existing.updatedBy = context.actorId;
      await alertRepo.save(existing);
    }
  }

  private parseAsset(raw: unknown): InsightsAsset {
    if (!raw || typeof raw !== 'object') {
      throw new BadRequestException('Insights asset must be an object');
    }
    const asset = raw as InsightsAsset;
    const hasContent =
      (asset.metrics && asset.metrics.length) ||
      (asset.dashboards && asset.dashboards.length) ||
      (asset.alerts && asset.alerts.length);
    if (!hasContent) {
      throw new BadRequestException('Insights asset must include metrics, dashboards, or alerts');
    }

    this.validateMetrics(asset.metrics || []);
    this.validateDashboards(asset.dashboards || []);
    this.validateAlerts(asset.alerts || []);

    return asset;
  }

  private validateMetrics(metrics: MetricDefinitionAsset[]): void {
    const seen = new Set<string>();
    for (const metric of metrics) {
      if (!metric.code || typeof metric.code !== 'string') {
        throw new BadRequestException('Metric code is required');
      }
      if (!this.isValidCode(metric.code)) {
        throw new BadRequestException(`Metric code ${metric.code} is invalid`);
      }
      if (seen.has(metric.code)) {
        throw new BadRequestException(`Duplicate metric code ${metric.code}`);
      }
      seen.add(metric.code);
      if (!metric.name || typeof metric.name !== 'string') {
        throw new BadRequestException(`Metric ${metric.code} is missing name`);
      }
      if (!metric.source_type) {
        throw new BadRequestException(`Metric ${metric.code} is missing source_type`);
      }
      if (!metric.aggregation) {
        throw new BadRequestException(`Metric ${metric.code} is missing aggregation`);
      }
      if (!metric.cadence) {
        throw new BadRequestException(`Metric ${metric.code} is missing cadence`);
      }
      if (metric.retention_days !== undefined && (!Number.isFinite(metric.retention_days) || metric.retention_days < 1)) {
        throw new BadRequestException(`Metric ${metric.code} has invalid retention_days`);
      }
    }
  }

  private validateDashboards(dashboards: DashboardDefinitionAsset[]): void {
    const seen = new Set<string>();
    for (const dashboard of dashboards) {
      if (!dashboard.code || typeof dashboard.code !== 'string') {
        throw new BadRequestException('Dashboard code is required');
      }
      if (!this.isValidCode(dashboard.code)) {
        throw new BadRequestException(`Dashboard code ${dashboard.code} is invalid`);
      }
      if (seen.has(dashboard.code)) {
        throw new BadRequestException(`Duplicate dashboard code ${dashboard.code}`);
      }
      seen.add(dashboard.code);
      if (!dashboard.name || typeof dashboard.name !== 'string') {
        throw new BadRequestException(`Dashboard ${dashboard.code} is missing name`);
      }
    }
  }

  private validateAlerts(alerts: AlertDefinitionAsset[]): void {
    const seen = new Set<string>();
    for (const alert of alerts) {
      if (!alert.code || typeof alert.code !== 'string') {
        throw new BadRequestException('Alert code is required');
      }
      if (!this.isValidCode(alert.code)) {
        throw new BadRequestException(`Alert code ${alert.code} is invalid`);
      }
      if (seen.has(alert.code)) {
        throw new BadRequestException(`Duplicate alert code ${alert.code}`);
      }
      seen.add(alert.code);
      if (!alert.name || typeof alert.name !== 'string') {
        throw new BadRequestException(`Alert ${alert.code} is missing name`);
      }
    }
  }

  private mergeMetadata(
    incoming: Record<string, unknown> | undefined,
    context: { packCode: string; releaseId: string; status?: 'draft' | 'published' | 'deprecated' },
    existing: Record<string, unknown> = {},
  ): Record<string, unknown> {
    const existingStatus = (existing as { status?: string }).status;
    const status = context.status || (existingStatus as 'draft' | 'published' | 'deprecated' | undefined) || 'draft';
    return {
      ...existing,
      ...incoming,
      status,
      pack: {
        code: context.packCode,
        release_id: context.releaseId,
      },
    };
  }

  private assertPackOwnership(
    metadata: Record<string, unknown>,
    packCode: string,
    entityType: 'metric' | 'dashboard' | 'alert',
    entityCode: string,
  ): void {
    const existingPack = (metadata as { pack?: { code?: string } }).pack?.code;
    if (existingPack && existingPack !== packCode) {
      throw new ConflictException(
        `${entityType} ${entityCode} is owned by pack ${existingPack}`,
      );
    }
  }

  private isValidCode(value: string): boolean {
    return /^[a-z0-9_]+$/.test(value);
  }
}
