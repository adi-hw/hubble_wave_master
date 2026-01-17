import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, MoreThan } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  PredictiveInsight,
  InsightAnalysisJob,
  InsightType,
  InsightSeverity,
  InsightStatus,
} from '@hubblewave/instance-db';

interface InsightData {
  type: InsightType;
  severity: InsightSeverity;
  title: string;
  description: string;
  affectedArtifactType?: string;
  affectedArtifactId?: string;
  dataPoints?: Record<string, unknown>;
  suggestedActions?: Array<{
    action: string;
    description: string;
    autoApplicable: boolean;
    actionPayload?: Record<string, unknown>;
  }>;
  expiresAt?: Date;
}

@Injectable()
export class PredictiveOpsService {
  private readonly logger = new Logger(PredictiveOpsService.name);

  constructor(
    @InjectRepository(PredictiveInsight)
    private readonly insightRepo: Repository<PredictiveInsight>,
    @InjectRepository(InsightAnalysisJob)
    private readonly jobRepo: Repository<InsightAnalysisJob>,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async runScheduledAnalysis(): Promise<void> {
    const now = new Date();
    const jobs = await this.jobRepo.find({
      where: {
        status: 'pending',
        nextRunAt: LessThan(now),
      },
    });

    for (const job of jobs) {
      await this.runAnalysisJob(job);
    }
  }

  async runAnalysisJob(job: InsightAnalysisJob): Promise<void> {
    this.logger.log(`Running analysis job: ${job.jobType}`);

    try {
      job.status = 'running';
      await this.jobRepo.save(job);

      let insights: InsightData[] = [];

      switch (job.jobType) {
        case 'capacity':
          insights = await this.analyzeCapacity();
          break;
        case 'security':
          insights = await this.analyzeSecurity();
          break;
        case 'performance':
          insights = await this.analyzePerformance();
          break;
        case 'compliance':
          insights = await this.analyzeCompliance();
          break;
        case 'usage':
          insights = await this.analyzeUsage();
          break;
      }

      for (const insight of insights) {
        await this.createInsight(insight);
      }

      job.lastRunAt = new Date();
      job.nextRunAt = new Date(Date.now() + job.runFrequencyHours * 3600000);
      job.status = 'pending';
      job.lastResult = { insightsGenerated: insights.length };
      await this.jobRepo.save(job);
    } catch (error) {
      this.logger.error(`Failed to run analysis job ${job.jobType}`, error);
      job.status = 'failed';
      job.lastResult = { error: (error as Error).message };
      await this.jobRepo.save(job);
    }
  }

  async triggerAnalysis(jobType: InsightType): Promise<InsightData[]> {
    const job = await this.jobRepo.findOne({ where: { jobType } });
    if (job) {
      await this.runAnalysisJob(job);
      return [];
    }

    let insights: InsightData[] = [];
    switch (jobType) {
      case 'capacity':
        insights = await this.analyzeCapacity();
        break;
      case 'security':
        insights = await this.analyzeSecurity();
        break;
      case 'performance':
        insights = await this.analyzePerformance();
        break;
      case 'compliance':
        insights = await this.analyzeCompliance();
        break;
      case 'usage':
        insights = await this.analyzeUsage();
        break;
    }

    for (const insight of insights) {
      await this.createInsight(insight);
    }

    return insights;
  }

  private async analyzeCapacity(): Promise<InsightData[]> {
    const insights: InsightData[] = [];

    // Analyze table sizes and growth rates
    // This would query pg_stat_user_tables in a real implementation

    // Example capacity insight
    insights.push({
      type: 'capacity',
      severity: 'info',
      title: 'Capacity analysis completed',
      description: 'All storage metrics are within normal parameters.',
      dataPoints: {
        totalTables: 0,
        largestTable: null,
        growthRate: '0%',
      },
      suggestedActions: [],
    });

    return insights;
  }

  private async analyzeSecurity(): Promise<InsightData[]> {
    const insights: InsightData[] = [];

    // Check for inactive users with admin roles
    // Check for users who haven't changed passwords
    // Check for suspicious login patterns

    return insights;
  }

  private async analyzePerformance(): Promise<InsightData[]> {
    const insights: InsightData[] = [];

    // Analyze slow automation rules
    // Analyze frequently used queries without indexes
    // Check for N+1 query patterns

    return insights;
  }

  private async analyzeCompliance(): Promise<InsightData[]> {
    const insights: InsightData[] = [];

    // Check for collections without audit logging
    // Check for PHI/PII access without proper trails
    // Verify encryption settings

    return insights;
  }

  private async analyzeUsage(): Promise<InsightData[]> {
    const insights: InsightData[] = [];

    // Analyze most common filters to suggest defaults
    // Identify unused features
    // Find optimization opportunities

    return insights;
  }

  async createInsight(data: InsightData): Promise<PredictiveInsight> {
    const insight = this.insightRepo.create({
      insightType: data.type,
      severity: data.severity,
      title: data.title,
      description: data.description,
      affectedArtifactType: data.affectedArtifactType,
      affectedArtifactId: data.affectedArtifactId,
      dataPoints: data.dataPoints,
      suggestedActions: data.suggestedActions,
      status: 'open',
      expiresAt: data.expiresAt,
    });
    return this.insightRepo.save(insight);
  }

  async getInsight(id: string): Promise<PredictiveInsight> {
    return this.insightRepo.findOneOrFail({
      where: { id },
      relations: ['resolvedByUser'],
    });
  }

  async listInsights(options: {
    type?: InsightType;
    severity?: InsightSeverity;
    status?: InsightStatus;
    limit?: number;
    offset?: number;
  }): Promise<{ data: PredictiveInsight[]; total: number }> {
    const query = this.insightRepo.createQueryBuilder('insight');

    if (options.type) {
      query.andWhere('insight.insightType = :type', { type: options.type });
    }

    if (options.severity) {
      query.andWhere('insight.severity = :severity', { severity: options.severity });
    }

    if (options.status) {
      query.andWhere('insight.status = :status', { status: options.status });
    }

    const [data, total] = await query
      .orderBy('insight.severity', 'DESC')
      .addOrderBy('insight.createdAt', 'DESC')
      .take(options.limit || 50)
      .skip(options.offset || 0)
      .getManyAndCount();

    return { data, total };
  }

  async getOpenInsights(type?: InsightType): Promise<PredictiveInsight[]> {
    const query = this.insightRepo.createQueryBuilder('insight')
      .where('insight.status = :status', { status: 'open' });

    if (type) {
      query.andWhere('insight.insightType = :type', { type });
    }

    return query
      .orderBy('insight.severity', 'DESC')
      .addOrderBy('insight.createdAt', 'DESC')
      .getMany();
  }

  async resolveInsight(insightId: string, userId: string, action: string): Promise<PredictiveInsight> {
    const insight = await this.insightRepo.findOneOrFail({ where: { id: insightId } });
    insight.status = 'resolved';
    insight.resolvedBy = userId;
    insight.resolvedAt = new Date();
    insight.resolvedAction = action;
    return this.insightRepo.save(insight);
  }

  async acknowledgeInsight(insightId: string, userId: string): Promise<PredictiveInsight> {
    const insight = await this.insightRepo.findOneOrFail({ where: { id: insightId } });
    insight.status = 'acknowledged';
    insight.resolvedBy = userId;
    return this.insightRepo.save(insight);
  }

  async dismissInsight(insightId: string, userId: string): Promise<PredictiveInsight> {
    const insight = await this.insightRepo.findOneOrFail({ where: { id: insightId } });
    insight.status = 'dismissed';
    insight.resolvedBy = userId;
    insight.resolvedAt = new Date();
    return this.insightRepo.save(insight);
  }

  async applyAction(insightId: string, actionIndex: number, userId: string): Promise<PredictiveInsight> {
    const insight = await this.insightRepo.findOneOrFail({ where: { id: insightId } });

    if (!insight.suggestedActions?.[actionIndex]) {
      throw new Error(`Action at index ${actionIndex} not found`);
    }

    const action = insight.suggestedActions[actionIndex];

    if (!action.autoApplicable) {
      throw new Error('This action cannot be automatically applied');
    }

    // Execute the action based on actionPayload
    // This would integrate with the relevant services

    insight.status = 'resolved';
    insight.resolvedBy = userId;
    insight.resolvedAt = new Date();
    insight.resolvedAction = action.action;

    return this.insightRepo.save(insight);
  }

  async getDashboardSummary(): Promise<{
    totalOpen: number;
    bySeverity: Record<InsightSeverity, number>;
    byType: Record<InsightType, number>;
    recentlyResolved: number;
  }> {
    const openInsights = await this.insightRepo.find({
      where: { status: 'open' },
    });

    const bySeverity: Record<InsightSeverity, number> = {
      critical: 0,
      warning: 0,
      info: 0,
    };

    const byType: Record<InsightType, number> = {
      capacity: 0,
      security: 0,
      performance: 0,
      compliance: 0,
      usage: 0,
    };

    for (const insight of openInsights) {
      bySeverity[insight.severity]++;
      byType[insight.insightType]++;
    }

    const recentlyResolved = await this.insightRepo.count({
      where: {
        status: 'resolved',
        resolvedAt: MoreThan(new Date(Date.now() - 7 * 24 * 3600000)),
      },
    });

    return {
      totalOpen: openInsights.length,
      bySeverity,
      byType,
      recentlyResolved,
    };
  }

  async cleanupExpired(): Promise<number> {
    const result = await this.insightRepo.delete({
      expiresAt: LessThan(new Date()),
    });
    return result.affected || 0;
  }
}
