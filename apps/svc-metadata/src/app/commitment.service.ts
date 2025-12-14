import { Injectable, Logger } from '@nestjs/common';
import { DataSource, LessThan, In, Between } from 'typeorm';
import {
  CommitmentDefinition,
  CommitmentTracker,
  CommitmentMetrics,
  BusinessSchedule,
  HolidayCalendar,
  Holiday,
} from '@eam-platform/tenant-db';

export interface StartCommitmentInput {
  commitmentDefinitionId: string;
  collectionCode: string;
  recordId: string;
  metadata?: Record<string, unknown>;
}

export interface CommitmentTimeResult {
  targetMinutes: number;
  targetAt: Date;
  warningAt: Date;
}

@Injectable()
export class CommitmentService {
  private readonly logger = new Logger(CommitmentService.name);

  // ============ Business Schedule ============

  async getSchedules(dataSource: DataSource): Promise<BusinessSchedule[]> {
    const repo = dataSource.getRepository(BusinessSchedule);
    return repo.find({ where: { isActive: true }, order: { name: 'ASC' } });
  }

  async getSchedule(dataSource: DataSource, id: string): Promise<BusinessSchedule | null> {
    const repo = dataSource.getRepository(BusinessSchedule);
    return repo.findOne({ where: { id } });
  }

  async getDefaultSchedule(dataSource: DataSource): Promise<BusinessSchedule | null> {
    const repo = dataSource.getRepository(BusinessSchedule);
    return repo.findOne({ where: { isDefault: true, isActive: true } });
  }

  // ============ Holiday Calendar ============

  async getHolidayCalendars(dataSource: DataSource): Promise<HolidayCalendar[]> {
    const repo = dataSource.getRepository(HolidayCalendar);
    return repo.find({ where: { isActive: true }, order: { name: 'ASC' } });
  }

  async getHolidays(
    dataSource: DataSource,
    calendarId: string,
    startDate: Date,
    endDate: Date
  ): Promise<Holiday[]> {
    const repo = dataSource.getRepository(Holiday);
    return repo.find({
      where: {
        calendarId,
        isActive: true,
        date: Between(startDate, endDate),
      },
      order: { date: 'ASC' },
    });
  }

  // ============ Commitment Definition ============

  async getDefinitions(
    dataSource: DataSource,
    collectionCode?: string
  ): Promise<CommitmentDefinition[]> {
    const repo = dataSource.getRepository(CommitmentDefinition);
    const where: Record<string, unknown> = { isActive: true };
    if (collectionCode) {
      where['collectionCode'] = collectionCode;
    }
    return repo.find({ where, order: { priority: 'DESC', name: 'ASC' } });
  }

  async getDefinition(
    dataSource: DataSource,
    id: string
  ): Promise<CommitmentDefinition | null> {
    const repo = dataSource.getRepository(CommitmentDefinition);
    return repo.findOne({
      where: { id },
      relations: ['businessSchedule', 'holidayCalendar'],
    });
  }

  async createDefinition(
    dataSource: DataSource,
    data: Partial<CommitmentDefinition>
  ): Promise<CommitmentDefinition> {
    const repo = dataSource.getRepository(CommitmentDefinition);
    const definition = repo.create(data);
    return repo.save(definition);
  }

  async updateDefinition(
    dataSource: DataSource,
    id: string,
    data: Partial<CommitmentDefinition>
  ): Promise<CommitmentDefinition> {
    const repo = dataSource.getRepository(CommitmentDefinition);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await repo.update(id, data as any);
    return repo.findOneOrFail({ where: { id } });
  }

  // ============ Commitment Tracking ============

  async startTracking(
    dataSource: DataSource,
    input: StartCommitmentInput
  ): Promise<CommitmentTracker> {
    const definition = await this.getDefinition(dataSource, input.commitmentDefinitionId);
    if (!definition) {
      throw new Error('Commitment definition not found');
    }

    const now = new Date();
    const timeResult = await this.calculateTargetTime(
      dataSource,
      definition,
      now
    );

    const repo = dataSource.getRepository(CommitmentTracker);
    const tracker = repo.create({
      commitmentDefinitionId: input.commitmentDefinitionId,
      collectionCode: input.collectionCode,
      recordId: input.recordId,
      status: 'active',
      startedAt: now,
      targetAt: timeResult.targetAt,
      warningAt: timeResult.warningAt,
      metadata: input.metadata,
      history: [
        {
          timestamp: now.toISOString(),
          action: 'started',
          details: { targetMinutes: timeResult.targetMinutes },
        },
      ],
    });

    return repo.save(tracker);
  }

  async pauseTracking(
    dataSource: DataSource,
    trackerId: string,
    reason?: string
  ): Promise<CommitmentTracker> {
    const repo = dataSource.getRepository(CommitmentTracker);
    const tracker = await repo.findOneOrFail({ where: { id: trackerId } });

    if (tracker.status !== 'active' && tracker.status !== 'warning') {
      throw new Error('Cannot pause a tracker that is not active');
    }

    const now = new Date();
    tracker.status = 'paused';
    tracker.pausedAt = now;
    tracker.history.push({
      timestamp: now.toISOString(),
      action: 'paused',
      fromStatus: tracker.status,
      toStatus: 'paused',
      details: { reason },
    });

    return repo.save(tracker);
  }

  async resumeTracking(
    dataSource: DataSource,
    trackerId: string
  ): Promise<CommitmentTracker> {
    const repo = dataSource.getRepository(CommitmentTracker);
    const tracker = await repo.findOneOrFail({ where: { id: trackerId } });

    if (tracker.status !== 'paused') {
      throw new Error('Cannot resume a tracker that is not paused');
    }

    const now = new Date();
    const pausedMinutes = tracker.pausedAt
      ? Math.floor((now.getTime() - tracker.pausedAt.getTime()) / 60000)
      : 0;

    tracker.totalPausedMinutes += pausedMinutes;
    tracker.status = 'active';
    tracker.pausedAt = undefined;

    // Extend target time by paused duration
    tracker.targetAt = new Date(tracker.targetAt.getTime() + pausedMinutes * 60000);
    if (tracker.warningAt) {
      tracker.warningAt = new Date(tracker.warningAt.getTime() + pausedMinutes * 60000);
    }

    tracker.history.push({
      timestamp: now.toISOString(),
      action: 'resumed',
      fromStatus: 'paused',
      toStatus: 'active',
      details: { pausedMinutes },
    });

    return repo.save(tracker);
  }

  async completeTracking(
    dataSource: DataSource,
    trackerId: string,
    met: boolean
  ): Promise<CommitmentTracker> {
    const repo = dataSource.getRepository(CommitmentTracker);
    const tracker = await repo.findOneOrFail({ where: { id: trackerId } });

    const now = new Date();
    const actualMinutes = Math.floor(
      (now.getTime() - tracker.startedAt.getTime()) / 60000
    ) - tracker.totalPausedMinutes;

    const definition = await this.getDefinition(
      dataSource,
      tracker.commitmentDefinitionId
    );
    const targetMinutes = definition?.targetMinutes || 0;
    const percentageUsed = targetMinutes > 0
      ? Math.round((actualMinutes / targetMinutes) * 10000) / 100
      : 0;

    tracker.status = met ? 'met' : 'breached';
    tracker.completedAt = now;
    tracker.actualMinutes = actualMinutes;
    tracker.percentageUsed = percentageUsed;
    tracker.breached = !met;
    if (!met) {
      tracker.breachedAt = now;
    }

    tracker.history.push({
      timestamp: now.toISOString(),
      action: met ? 'met' : 'breached',
      toStatus: tracker.status,
      details: { actualMinutes, percentageUsed },
    });

    return repo.save(tracker);
  }

  async cancelTracking(
    dataSource: DataSource,
    trackerId: string,
    reason?: string
  ): Promise<CommitmentTracker> {
    const repo = dataSource.getRepository(CommitmentTracker);
    const tracker = await repo.findOneOrFail({ where: { id: trackerId } });

    const now = new Date();
    tracker.status = 'cancelled';
    tracker.completedAt = now;
    tracker.history.push({
      timestamp: now.toISOString(),
      action: 'cancelled',
      toStatus: 'cancelled',
      details: { reason },
    });

    return repo.save(tracker);
  }

  // ============ Tracking Queries ============

  async getActiveTrackers(
    dataSource: DataSource,
    collectionCode?: string,
    recordId?: string
  ): Promise<CommitmentTracker[]> {
    const repo = dataSource.getRepository(CommitmentTracker);
    const where: Record<string, unknown> = {
      status: In(['active', 'warning', 'paused']),
    };
    if (collectionCode) where['collectionCode'] = collectionCode;
    if (recordId) where['recordId'] = recordId;

    return repo.find({
      where,
      relations: ['commitmentDefinition'],
      order: { targetAt: 'ASC' },
    });
  }

  async getRecordCommitments(
    dataSource: DataSource,
    collectionCode: string,
    recordId: string
  ): Promise<CommitmentTracker[]> {
    const repo = dataSource.getRepository(CommitmentTracker);
    return repo.find({
      where: { collectionCode, recordId },
      relations: ['commitmentDefinition'],
      order: { createdAt: 'DESC' },
    });
  }

  async getApproachingBreaches(
    dataSource: DataSource,
    withinMinutes: number = 60
  ): Promise<CommitmentTracker[]> {
    const repo = dataSource.getRepository(CommitmentTracker);
    const now = new Date();
    const threshold = new Date(now.getTime() + withinMinutes * 60000);

    return repo.find({
      where: {
        status: In(['active', 'warning']),
        targetAt: LessThan(threshold),
      },
      relations: ['commitmentDefinition'],
      order: { targetAt: 'ASC' },
    });
  }

  // ============ Scheduled Checks ============

  async processWarnings(dataSource: DataSource): Promise<number> {
    const repo = dataSource.getRepository(CommitmentTracker);
    const now = new Date();

    // Find trackers that should be in warning state
    const trackers = await repo.find({
      where: {
        status: 'active',
        warningSent: false,
        warningAt: LessThan(now),
      },
      relations: ['commitmentDefinition'],
    });

    let processed = 0;
    for (const tracker of trackers) {
      tracker.status = 'warning';
      tracker.warningSent = true;
      tracker.warningSentAt = now;
      tracker.history.push({
        timestamp: now.toISOString(),
        action: 'warning_triggered',
        fromStatus: 'active',
        toStatus: 'warning',
      });
      await repo.save(tracker);

      // Execute warning actions
      if (tracker.commitmentDefinition?.warningActions) {
        await this.executeActions(
          dataSource,
          tracker,
          tracker.commitmentDefinition.warningActions
        );
      }

      processed++;
    }

    this.logger.log(`Processed ${processed} commitment warnings`);
    return processed;
  }

  async processBreaches(dataSource: DataSource): Promise<number> {
    const repo = dataSource.getRepository(CommitmentTracker);
    const now = new Date();

    // Find trackers that have breached
    const trackers = await repo.find({
      where: {
        status: In(['active', 'warning']),
        breached: false,
        targetAt: LessThan(now),
      },
      relations: ['commitmentDefinition'],
    });

    let processed = 0;
    for (const tracker of trackers) {
      tracker.status = 'breached';
      tracker.breached = true;
      tracker.breachedAt = now;
      tracker.history.push({
        timestamp: now.toISOString(),
        action: 'breached',
        toStatus: 'breached',
      });
      await repo.save(tracker);

      // Execute breach actions
      if (tracker.commitmentDefinition?.breachActions) {
        await this.executeActions(
          dataSource,
          tracker,
          tracker.commitmentDefinition.breachActions
        );
      }

      processed++;
    }

    this.logger.log(`Processed ${processed} commitment breaches`);
    return processed;
  }

  // ============ Metrics ============

  async updateMetrics(
    dataSource: DataSource,
    definitionId: string,
    periodDate: Date,
    periodType: string = 'daily'
  ): Promise<CommitmentMetrics> {
    const trackerRepo = dataSource.getRepository(CommitmentTracker);
    const metricsRepo = dataSource.getRepository(CommitmentMetrics);

    // Calculate metrics
    const baseQuery = trackerRepo
      .createQueryBuilder('t')
      .where('t.commitment_definition_id = :definitionId', { definitionId })
      .andWhere("DATE(t.completed_at) = :periodDate", { periodDate });

    const stats = await baseQuery
      .select([
        'COUNT(*) as total',
        "COUNT(CASE WHEN t.status = 'met' THEN 1 END) as met",
        "COUNT(CASE WHEN t.status = 'breached' THEN 1 END) as breached",
        "COUNT(CASE WHEN t.warning_sent = true THEN 1 END) as warned",
        "COUNT(CASE WHEN t.status = 'cancelled' THEN 1 END) as cancelled",
        'AVG(t.actual_minutes) as avg_minutes',
        'AVG(t.percentage_used) as avg_percentage',
      ])
      .getRawOne();

    const total = parseInt(stats?.['total'] || '0');
    const met = parseInt(stats?.['met'] || '0');
    const breached = parseInt(stats?.['breached'] || '0');
    const warned = parseInt(stats?.['warned'] || '0');
    const cancelled = parseInt(stats?.['cancelled'] || '0');
    const complianceRate = total > 0 ? Math.round((met / total) * 10000) / 100 : null;

    // Upsert metrics
    let metrics = await metricsRepo.findOne({
      where: { commitmentDefinitionId: definitionId, periodDate, periodType },
    });

    if (metrics) {
      metrics.totalTracked = total;
      metrics.metCount = met;
      metrics.breachedCount = breached;
      metrics.warningCount = warned;
      metrics.cancelledCount = cancelled;
      metrics.complianceRate = complianceRate ?? undefined;
      metrics.avgResolutionMinutes = parseFloat(stats?.['avg_minutes']) || undefined;
      metrics.avgPercentageUsed = parseFloat(stats?.['avg_percentage']) || undefined;
      return metricsRepo.save(metrics);
    } else {
      const newMetrics = new CommitmentMetrics();
      newMetrics.commitmentDefinitionId = definitionId;
      newMetrics.periodDate = periodDate;
      newMetrics.periodType = periodType;
      newMetrics.totalTracked = total;
      newMetrics.metCount = met;
      newMetrics.breachedCount = breached;
      newMetrics.warningCount = warned;
      newMetrics.cancelledCount = cancelled;
      newMetrics.complianceRate = complianceRate ?? undefined;
      newMetrics.avgResolutionMinutes = parseFloat(stats?.['avg_minutes']) || undefined;
      newMetrics.avgPercentageUsed = parseFloat(stats?.['avg_percentage']) || undefined;
      return metricsRepo.save(newMetrics);
    }
  }

  async getMetrics(
    dataSource: DataSource,
    definitionId: string,
    startDate: Date,
    endDate: Date,
    periodType: string = 'daily'
  ): Promise<CommitmentMetrics[]> {
    const repo = dataSource.getRepository(CommitmentMetrics);
    return repo.find({
      where: {
        commitmentDefinitionId: definitionId,
        periodType,
        periodDate: Between(startDate, endDate),
      },
      order: { periodDate: 'ASC' },
    });
  }

  // ============ Helper Methods ============

  private async calculateTargetTime(
    dataSource: DataSource,
    definition: CommitmentDefinition,
    startTime: Date
  ): Promise<CommitmentTimeResult> {
    let targetMinutes = definition.targetMinutes;
    let targetAt: Date;
    let warningAt: Date;

    if (definition.useBusinessHours && definition.businessScheduleId) {
      // Calculate using business hours
      const schedule = await this.getSchedule(dataSource, definition.businessScheduleId);
      if (schedule) {
        const holidays = definition.holidayCalendarId
          ? await this.getHolidays(
              dataSource,
              definition.holidayCalendarId,
              startTime,
              new Date(startTime.getTime() + targetMinutes * 60000 * 3) // Rough estimate
            )
          : [];

        targetAt = this.addBusinessMinutes(
          startTime,
          targetMinutes,
          schedule,
          holidays
        );
      } else {
        targetAt = new Date(startTime.getTime() + targetMinutes * 60000);
      }
    } else {
      targetAt = new Date(startTime.getTime() + targetMinutes * 60000);
    }

    // Calculate warning time
    const warningMinutes = Math.floor(
      targetMinutes * (definition.warningThresholdPercent / 100)
    );
    warningAt = new Date(startTime.getTime() + warningMinutes * 60000);

    return { targetMinutes, targetAt, warningAt };
  }

  private addBusinessMinutes(
    startTime: Date,
    minutes: number,
    schedule: BusinessSchedule,
    holidays: Holiday[]
  ): Date {
    const holidayDates = new Set(
      holidays.map((h) => h.date.toISOString().split('T')[0])
    );

    let remaining = minutes;
    let current = new Date(startTime);

    while (remaining > 0) {
      const dateStr = current.toISOString().split('T')[0];
      const dayName = this.getDayName(current.getDay());
      const daySchedule = schedule.workingHours[dayName as keyof typeof schedule.workingHours];

      if (daySchedule?.enabled && !holidayDates.has(dateStr)) {
        const startOfDay = this.parseTime(daySchedule.start, current);
        const endOfDay = this.parseTime(daySchedule.end, current);

        if (current < startOfDay) {
          current = startOfDay;
        }

        if (current < endOfDay) {
          const availableMinutes = Math.floor(
            (endOfDay.getTime() - current.getTime()) / 60000
          );

          if (availableMinutes >= remaining) {
            current = new Date(current.getTime() + remaining * 60000);
            remaining = 0;
          } else {
            remaining -= availableMinutes;
            current = new Date(endOfDay);
          }
        }
      }

      if (remaining > 0) {
        // Move to next day
        current = new Date(current);
        current.setDate(current.getDate() + 1);
        current.setHours(0, 0, 0, 0);
      }
    }

    return current;
  }

  private getDayName(dayIndex: number): string {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return days[dayIndex];
  }

  private parseTime(time: string, date: Date): Date {
    const [hours, minutes] = time.split(':').map(Number);
    const result = new Date(date);
    result.setHours(hours, minutes, 0, 0);
    return result;
  }

  private async executeActions(
    _dataSource: DataSource,
    tracker: CommitmentTracker,
    actions: CommitmentDefinition['warningActions']
  ): Promise<void> {
    for (const actionConfig of actions) {
      this.logger.log(
        `Executing action ${actionConfig.action} for tracker ${tracker.id}`
      );
      // TODO: Implement actual action execution (notify, escalate, webhook, etc.)
    }
  }
}
