/**
 * ScheduledJobService
 * HubbleWave Platform - Phase 3
 *
 * Service for managing scheduled automation jobs.
 */

import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual } from 'typeorm';
import {
  ScheduledJob,
  ScheduleFrequency,
  AutomationAction,
  ExecutionStatus,
} from '@hubblewave/instance-db';

export interface CreateScheduledJobDto {
  name: string;
  description?: string;
  collectionId?: string;
  frequency: ScheduleFrequency;
  cronExpression?: string;
  timezone?: string;
  actionType?: 'no_code' | 'script';
  actions?: AutomationAction[];
  script?: string;
  queryFilter?: Record<string, unknown>;
  isActive?: boolean;
  maxRetries?: number;
  metadata?: Record<string, unknown>;
}

export interface UpdateScheduledJobDto extends Partial<CreateScheduledJobDto> {}

@Injectable()
export class ScheduledJobService {
  private readonly logger = new Logger(ScheduledJobService.name);

  constructor(
    @InjectRepository(ScheduledJob)
    private readonly jobRepo: Repository<ScheduledJob>,
  ) {}

  /**
   * Get all scheduled jobs
   */
  async getAllJobs(includeInactive = false): Promise<ScheduledJob[]> {
    const query = this.jobRepo.createQueryBuilder('job')
      .orderBy('job.name', 'ASC');

    if (!includeInactive) {
      query.andWhere('job.is_active = :isActive', { isActive: true });
    }

    return query.getMany();
  }

  /**
   * Get jobs for a specific collection
   */
  async getJobsForCollection(collectionId: string): Promise<ScheduledJob[]> {
    return this.jobRepo.find({
      where: { collectionId, isActive: true },
      order: { name: 'ASC' },
    });
  }

  /**
   * Get job by ID
   */
  async getJobById(jobId: string): Promise<ScheduledJob | null> {
    return this.jobRepo.findOne({ where: { id: jobId } });
  }

  /**
   * Get job by ID (throws if not found)
   */
  async getJob(jobId: string): Promise<ScheduledJob> {
    const job = await this.getJobById(jobId);
    if (!job) {
      throw new NotFoundException(`Scheduled job with ID '${jobId}' not found`);
    }
    return job;
  }

  /**
   * Get due jobs that need to run
   */
  async getDueJobs(): Promise<ScheduledJob[]> {
    return this.jobRepo.find({
      where: {
        isActive: true,
        nextRunAt: LessThanOrEqual(new Date()),
      },
      order: { nextRunAt: 'ASC' },
    });
  }

  /**
   * Create a new scheduled job
   */
  async createJob(dto: CreateScheduledJobDto, userId?: string): Promise<ScheduledJob> {
    const existingName = await this.jobRepo.findOne({
      where: { name: dto.name },
    });

    if (existingName) {
      throw new ConflictException(`Scheduled job with name '${dto.name}' already exists`);
    }

    const nextRunAt = this.calculateNextRun(dto.frequency, dto.cronExpression, dto.timezone);

    const job = this.jobRepo.create({
      name: dto.name,
      description: dto.description,
      collectionId: dto.collectionId,
      frequency: dto.frequency,
      cronExpression: dto.cronExpression,
      timezone: dto.timezone ?? 'UTC',
      actionType: dto.actionType ?? 'no_code',
      actions: dto.actions,
      script: dto.script,
      queryFilter: dto.queryFilter,
      isActive: dto.isActive ?? true,
      nextRunAt,
      maxRetries: dto.maxRetries ?? 3,
      consecutiveFailures: 0,
      metadata: dto.metadata ?? {},
      createdBy: userId,
    });

    const saved = await this.jobRepo.save(job);
    this.logger.log(`Created scheduled job '${dto.name}'`);
    return saved;
  }

  /**
   * Update a scheduled job
   */
  async updateJob(
    jobId: string,
    dto: UpdateScheduledJobDto,
    userId?: string,
  ): Promise<ScheduledJob> {
    const existing = await this.getJob(jobId);

    const updateData: Record<string, unknown> = {};

    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.collectionId !== undefined) updateData.collectionId = dto.collectionId;
    if (dto.frequency !== undefined) updateData.frequency = dto.frequency;
    if (dto.cronExpression !== undefined) updateData.cronExpression = dto.cronExpression;
    if (dto.timezone !== undefined) updateData.timezone = dto.timezone;
    if (dto.actionType !== undefined) updateData.actionType = dto.actionType;
    if (dto.actions !== undefined) updateData.actions = dto.actions;
    if (dto.script !== undefined) updateData.script = dto.script;
    if (dto.queryFilter !== undefined) updateData.queryFilter = dto.queryFilter;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;
    if (dto.maxRetries !== undefined) updateData.maxRetries = dto.maxRetries;
    if (dto.metadata !== undefined) updateData.metadata = dto.metadata;
    updateData.updatedBy = userId;

    // Recalculate next run if schedule changed
    if (dto.frequency !== undefined || dto.cronExpression !== undefined) {
      const frequency = dto.frequency ?? existing.frequency;
      const cron = dto.cronExpression ?? existing.cronExpression;
      const tz = dto.timezone ?? existing.timezone;
      updateData.nextRunAt = this.calculateNextRun(frequency, cron, tz);
    }

    if (Object.keys(updateData).length > 1) {
      await this.jobRepo.update(jobId, updateData);
    }

    return this.getJob(jobId);
  }

  /**
   * Delete a scheduled job
   */
  async deleteJob(jobId: string): Promise<{ id: string; deleted: boolean }> {
    const existing = await this.getJob(jobId);
    await this.jobRepo.delete(jobId);
    this.logger.log(`Deleted scheduled job '${existing.name}'`);
    return { id: jobId, deleted: true };
  }

  /**
   * Toggle job active state
   */
  async toggleJob(jobId: string, userId?: string): Promise<ScheduledJob> {
    const existing = await this.getJob(jobId);

    await this.jobRepo.update(jobId, {
      isActive: !existing.isActive,
      updatedBy: userId,
    });

    return this.getJob(jobId);
  }

  /**
   * Record successful execution
   */
  async recordSuccess(jobId: string): Promise<void> {
    const job = await this.getJob(jobId);
    const nextRunAt = this.calculateNextRun(job.frequency, job.cronExpression, job.timezone);

    await this.jobRepo.update(jobId, {
      lastRunAt: new Date(),
      lastRunStatus: 'success' as ExecutionStatus,
      nextRunAt,
      consecutiveFailures: 0,
    });
  }

  /**
   * Record failed execution
   */
  async recordFailure(jobId: string): Promise<void> {
    const job = await this.getJob(jobId);

    const consecutiveFailures = job.consecutiveFailures + 1;
    const shouldDisable = consecutiveFailures >= job.maxRetries;

    await this.jobRepo.update(jobId, {
      lastRunAt: new Date(),
      lastRunStatus: 'error' as ExecutionStatus,
      consecutiveFailures,
      isActive: shouldDisable ? false : job.isActive,
    });

    if (shouldDisable) {
      this.logger.warn(`Scheduled job '${job.name}' disabled after ${consecutiveFailures} failures`);
    }
  }

  /**
   * Calculate next run time based on frequency
   */
  private calculateNextRun(
    frequency: ScheduleFrequency,
    cronExpression?: string,
    _timezone?: string,
  ): Date {
    const now = new Date();

    switch (frequency) {
      case 'hourly':
        now.setMinutes(0, 0, 0);
        now.setHours(now.getHours() + 1);
        return now;

      case 'daily':
        now.setHours(0, 0, 0, 0);
        now.setDate(now.getDate() + 1);
        return now;

      case 'weekly':
        now.setHours(0, 0, 0, 0);
        now.setDate(now.getDate() + (7 - now.getDay()) + 1);
        return now;

      case 'monthly':
        now.setHours(0, 0, 0, 0);
        now.setDate(1);
        now.setMonth(now.getMonth() + 1);
        return now;

      case 'cron':
        if (cronExpression) {
          return this.parseCronNextRun(cronExpression);
        }
        now.setHours(now.getHours() + 1);
        return now;

      case 'once':
      default:
        return now;
    }
  }

  /**
   * Parse cron expression to get next run time
   */
  private parseCronNextRun(cronExpression: string): Date {
    const parts = cronExpression.split(' ');
    if (parts.length < 5) {
      return new Date(Date.now() + 3600000);
    }

    const now = new Date();
    const [minute, hour, dayOfMonth, month, _dayOfWeek] = parts;

    const nextRun = new Date(now);

    if (hour !== '*') {
      nextRun.setHours(parseInt(hour, 10));
    }
    if (minute !== '*') {
      nextRun.setMinutes(parseInt(minute, 10));
    }
    nextRun.setSeconds(0);
    nextRun.setMilliseconds(0);

    if (nextRun <= now) {
      nextRun.setDate(nextRun.getDate() + 1);
    }

    if (dayOfMonth !== '*') {
      nextRun.setDate(parseInt(dayOfMonth, 10));
      if (nextRun <= now) {
        nextRun.setMonth(nextRun.getMonth() + 1);
      }
    }

    if (month !== '*') {
      nextRun.setMonth(parseInt(month, 10) - 1);
      if (nextRun <= now) {
        nextRun.setFullYear(nextRun.getFullYear() + 1);
      }
    }

    return nextRun;
  }
}
