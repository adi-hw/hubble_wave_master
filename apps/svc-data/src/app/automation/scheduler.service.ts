/**
 * SchedulerService
 * HubbleWave Platform - Phase 3
 *
 * Production-ready scheduled job execution using BullMQ.
 * Handles cron-based scheduling, retry logic, and distributed execution.
 */

import { Injectable, Logger, OnModuleInit, OnModuleDestroy, Inject, Optional } from '@nestjs/common';
import { Queue, Worker, Job, ConnectionOptions } from 'bullmq';
import { ScheduledJobService } from './scheduled-job.service';
import { ActionHandlerService } from './action-handler.service';
import { ScriptSandboxService } from './script-sandbox.service';
import { ExecutionLogService } from './execution-log.service';
import { ScheduledJob } from '@hubblewave/instance-db';

interface ScheduledJobPayload {
  jobId: string;
  jobName: string;
  collectionId?: string;
  actionType: string;
  actions?: Array<{ id: string; type: string; config: Record<string, unknown> }>;
  script?: string;
  queryFilter?: Record<string, unknown>;
}

@Injectable()
export class SchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SchedulerService.name);
  private queue: Queue | null = null;
  private worker: Worker | null = null;
  private connectionOptions: ConnectionOptions | null = null;
  private pollInterval: NodeJS.Timeout | null = null;
  private readonly POLL_INTERVAL_MS = 30000;

  constructor(
    private readonly scheduledJobService: ScheduledJobService,
    private readonly actionHandler: ActionHandlerService,
    private readonly scriptSandbox: ScriptSandboxService,
    private readonly executionLogService: ExecutionLogService,
    @Optional() @Inject('REDIS_HOST') private redisHost?: string,
    @Optional() @Inject('REDIS_PORT') private redisPort?: number,
  ) {}

  async onModuleInit() {
    try {
      await this.initializeBullMQ();
      this.startPolling();
      this.logger.log('Scheduler Service initialized with BullMQ');
    } catch (error) {
      this.logger.warn('Failed to initialize BullMQ, falling back to polling mode', error);
      this.startPolling();
    }
  }

  async onModuleDestroy() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }
    if (this.worker) {
      await this.worker.close();
    }
    if (this.queue) {
      await this.queue.close();
    }
    this.connectionOptions = null;
  }

  private async initializeBullMQ() {
    const host = this.redisHost ?? process.env['REDIS_HOST'] ?? 'localhost';
    const port = this.redisPort ?? parseInt(process.env['REDIS_PORT'] ?? '6379', 10);

    this.connectionOptions = {
      host,
      port,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    };

    this.queue = new Queue<ScheduledJobPayload, void>('scheduled-jobs', {
      connection: this.connectionOptions,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: {
          count: 1000,
        },
        removeOnFail: {
          count: 500,
        },
      },
    });

    this.worker = new Worker<ScheduledJobPayload, void>(
      'scheduled-jobs',
      async (job: Job<ScheduledJobPayload>) => this.processJob(job),
      {
        connection: this.connectionOptions,
        concurrency: 5,
      }
    );

    this.worker.on('completed', (job) => {
      this.logger.log(`Job ${job.id} completed successfully`);
    });

    this.worker.on('failed', (job, err) => {
      this.logger.error(`Job ${job?.id} failed: ${err.message}`);
    });
  }

  private startPolling() {
    this.pollInterval = setInterval(() => this.checkDueJobs(), this.POLL_INTERVAL_MS);
    this.logger.log(`Scheduler polling started (interval: ${this.POLL_INTERVAL_MS}ms)`);
    this.checkDueJobs();
  }

  private async checkDueJobs() {
    try {
      const dueJobs = await this.scheduledJobService.getDueJobs();
      for (const job of dueJobs) {
        await this.enqueueJob(job);
      }
    } catch (error) {
      this.logger.error('Error checking due jobs', error);
    }
  }

  async enqueueJob(job: ScheduledJob): Promise<string | undefined> {
    const payload: ScheduledJobPayload = {
      jobId: job.id,
      jobName: job.name,
      collectionId: job.collectionId ?? undefined,
      actionType: job.actionType,
      actions: job.actions as ScheduledJobPayload['actions'],
      script: job.script ?? undefined,
      queryFilter: job.queryFilter,
    };

    if (this.queue) {
      const enqueuedJob = await this.queue.add(job.name, payload, {
        jobId: `${job.id}-${Date.now()}`,
      });
      this.logger.debug(`Enqueued job ${job.name} with ID ${enqueuedJob.id}`);
      return enqueuedJob.id;
    } else {
      await this.processJobDirect(payload);
      return payload.jobId;
    }
  }

  private createExecutionContext(jobId: string, jobName: string, _collectionId?: string) {
    return {
      user: {
        id: 'system',
        email: 'scheduler@system',
        roles: ['system'],
      },
      record: {} as Record<string, unknown>,
      previousRecord: undefined,
      changes: [] as string[],
      automation: {
        id: jobId,
        name: jobName,
        triggerTiming: 'async' as const, // Scheduled jobs run asynchronously
        abortOnError: false,
      },
      depth: 1,
      maxDepth: 5,
      executionChain: [] as string[],
      recordsModified: new Map<string, Record<string, unknown>>(),
      outputs: {} as Record<string, unknown>,
      asyncQueue: [] as Array<{ action: { id: string; type: string; config: Record<string, unknown> }; executeAsync: boolean; executeAfterCommit: boolean }>,
      errors: [] as Array<{ property: string; message: string }>,
      warnings: [] as Array<{ property: string; message: string }>,
    };
  }

  private async processJob(job: Job<ScheduledJobPayload>): Promise<void> {
    const startTime = Date.now();
    const { jobId, jobName, collectionId, actionType, actions, script } = job.data;

    this.logger.log(`Processing scheduled job: ${jobName}`);

    try {
      const context = this.createExecutionContext(jobId, jobName, collectionId);

      if (actionType === 'script' && script) {
        await this.scriptSandbox.execute(script, context);
      } else if (actions && actions.length > 0) {
        for (const action of actions) {
          await this.actionHandler.execute(
            {
              id: action.id,
              type: action.type,
              config: action.config,
              continueOnError: false,
            },
            context
          );
        }
      }

      await this.scheduledJobService.recordSuccess(jobId);
      await this.executionLogService.log({
        scheduledJobId: jobId,
        automationType: 'scheduled',
        automationName: jobName,
        collectionId: collectionId ?? undefined,
        status: 'success',
        durationMs: Date.now() - startTime,
      });

      this.logger.log(`Scheduled job ${jobName} completed in ${Date.now() - startTime}ms`);
    } catch (error) {
      const err = error as Error;
      await this.scheduledJobService.recordFailure(jobId);
      await this.executionLogService.log({
        scheduledJobId: jobId,
        automationType: 'scheduled',
        automationName: jobName,
        collectionId: collectionId ?? undefined,
        status: 'error',
        errorMessage: err.message,
        errorStack: err.stack,
        durationMs: Date.now() - startTime,
      });

      this.logger.error(`Scheduled job ${jobName} failed: ${err.message}`);
      throw error;
    }
  }

  private async processJobDirect(payload: ScheduledJobPayload): Promise<void> {
    const startTime = Date.now();
    const { jobId, jobName, collectionId, actionType, actions, script } = payload;

    this.logger.log(`Processing scheduled job (direct): ${jobName}`);

    try {
      const context = this.createExecutionContext(jobId, jobName, collectionId);

      if (actionType === 'script' && script) {
        await this.scriptSandbox.execute(script, context);
      } else if (actions && actions.length > 0) {
        for (const action of actions) {
          await this.actionHandler.execute(
            {
              id: action.id,
              type: action.type,
              config: action.config,
              continueOnError: false,
            },
            context
          );
        }
      }

      await this.scheduledJobService.recordSuccess(jobId);
      await this.executionLogService.log({
        scheduledJobId: jobId,
        automationType: 'scheduled',
        automationName: jobName,
        collectionId: collectionId ?? undefined,
        status: 'success',
        durationMs: Date.now() - startTime,
      });

    } catch (error) {
      const err = error as Error;
      await this.scheduledJobService.recordFailure(jobId);
      await this.executionLogService.log({
        scheduledJobId: jobId,
        automationType: 'scheduled',
        automationName: jobName,
        collectionId: collectionId ?? undefined,
        status: 'error',
        errorMessage: err.message,
        errorStack: err.stack,
        durationMs: Date.now() - startTime,
      });

      throw error;
    }
  }

  async triggerJob(jobId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const job = await this.scheduledJobService.getJob(jobId);
      await this.enqueueJob(job);
      return { success: true };
    } catch (error) {
      const err = error as Error;
      return { success: false, error: err.message };
    }
  }

  async getQueueStats(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
  }> {
    if (!this.queue) {
      return { waiting: 0, active: 0, completed: 0, failed: 0 };
    }

    const [waiting, active, completed, failed] = await Promise.all([
      this.queue.getWaitingCount(),
      this.queue.getActiveCount(),
      this.queue.getCompletedCount(),
      this.queue.getFailedCount(),
    ]);

    return { waiting, active, completed, failed };
  }
}
