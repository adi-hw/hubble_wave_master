/**
 * SchedulerService
 * HubbleWave Platform - Phase 3
 *
 * Production-ready scheduled job execution using BullMQ.
 * Handles cron-based scheduling, retry logic, and distributed execution.
 */

import { Injectable, Logger, OnModuleInit, OnModuleDestroy, Inject, Optional } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Queue, Worker, Job, ConnectionOptions } from 'bullmq';
import { ScheduledJobService } from './scheduled-job.service';
import { ActionHandlerService } from '../../../../api/src/app/automation/runtime/action-handler.service';
import { ScriptSandboxService } from '../../../../api/src/app/automation/runtime/script-sandbox.service';
import { ExecutionLogService } from '../../../../api/src/app/automation/runtime/execution-log.service';
import { ScheduledJob } from '@hubblewave/instance-db';
import { AutomationRateLimiterService } from './automation-rate-limiter.service';

interface ScheduledJobPayload {
  jobId: string;
  jobName: string;
  /**
   * Stable identifier used by the per-automation rate limiter (W7.C / Plan
   * Fix 14). For scheduled jobs the natural grouping key is the job's own id,
   * so a single misconfigured schedule cannot starve sibling schedules sharing
   * the worker pool.
   */
  automationId: string;
  collectionId?: string;
  actionType: string;
  actions?: Array<{ id: string; type: string; config: Record<string, unknown> }>;
  script?: string;
  queryFilter?: Record<string, unknown>;
}

interface DlqPayload {
  originalJob: ReturnType<Job['toJSON']>;
  error: string;
  stack?: string;
  failedAt: string;
}

interface ScheduledJobFailedEvent {
  jobId: string | undefined;
  automationId: string | undefined;
  error: string;
}

const SCHEDULED_JOBS_QUEUE = 'scheduled-jobs';
const SCHEDULED_JOBS_DLQ = 'scheduled-jobs-dlq';
const SCHEDULED_JOB_FAILED_EVENT = 'scheduled_job.failed';

@Injectable()
export class SchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SchedulerService.name);
  private queue: Queue | null = null;
  private dlqQueue: Queue<DlqPayload, void> | null = null;
  private worker: Worker | null = null;
  private connectionOptions: ConnectionOptions | null = null;
  private pollInterval: NodeJS.Timeout | null = null;
  private readonly POLL_INTERVAL_MS = 30000;

  constructor(
    private readonly scheduledJobService: ScheduledJobService,
    private readonly actionHandler: ActionHandlerService,
    private readonly scriptSandbox: ScriptSandboxService,
    private readonly executionLogService: ExecutionLogService,
    private readonly eventEmitter: EventEmitter2,
    private readonly rateLimiter: AutomationRateLimiterService,
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
    if (this.dlqQueue) {
      await this.dlqQueue.close();
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

    this.queue = new Queue<ScheduledJobPayload, void>(SCHEDULED_JOBS_QUEUE, {
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
        // Intermediate failures still age out so Redis doesn't grow unbounded.
        // The DLQ entry written from the worker `failed` handler is what
        // preserves trace data for jobs that exhaust their retries.
        removeOnFail: {
          count: 500,
        },
      },
    });

    this.dlqQueue = new Queue<DlqPayload, void>(SCHEDULED_JOBS_DLQ, {
      connection: this.connectionOptions,
    });

    this.worker = new Worker<ScheduledJobPayload, void>(
      SCHEDULED_JOBS_QUEUE,
      async (job: Job<ScheduledJobPayload>) => this.processJob(job),
      {
        connection: this.connectionOptions,
        concurrency: 5,
      }
    );

    this.worker.on('completed', (job) => {
      this.logger.log(`Job ${job.id} completed successfully`);
    });

    this.worker.on('failed', async (job, err) => {
      this.logger.error(`Job ${job?.id} failed: ${err.message}`);
      await this.handleWorkerFailure(job, err);
    });
  }

  /**
   * On the FINAL retry attempt only, persist a Dead Letter Queue entry and
   * emit a domain event so alerting subscribers can react. Intermediate
   * retry failures take BullMQ's normal backoff path and are not enqueued
   * to the DLQ — only true exhaustion produces a DLQ entry.
   */
  private async handleWorkerFailure(
    job: Job<ScheduledJobPayload> | undefined,
    err: Error,
  ): Promise<void> {
    if (!job) {
      return;
    }

    const maxAttempts = job.opts.attempts ?? 1;
    if (job.attemptsMade < maxAttempts) {
      return;
    }

    try {
      if (this.dlqQueue) {
        const dlqEntry: DlqPayload = {
          originalJob: job.toJSON(),
          error: err.message,
          stack: err.stack,
          failedAt: new Date().toISOString(),
        };
        await this.dlqQueue.add('failed-job', dlqEntry);
      }
    } catch (dlqError) {
      const dlqErr = dlqError as Error;
      this.logger.error(
        `Failed to enqueue job ${job.id} to DLQ: ${dlqErr.message}`,
        dlqErr.stack,
      );
    }

    const event: ScheduledJobFailedEvent = {
      jobId: job.id,
      automationId: job.data?.jobId,
      error: err.message,
    };
    this.eventEmitter.emit(SCHEDULED_JOB_FAILED_EVENT, event);
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
      automationId: job.id,
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
        id: 'system' as string | null,
        email: 'scheduler@system',
        roles: ['system'],
      },
      record: {} as Record<string, unknown>,
      previousRecord: null as Record<string, unknown> | null,
      changes: [] as string[],
      automation: {
        id: jobId,
        name: jobName,
        triggerTiming: 'async' as const,
        abortOnError: false,
      },
      depth: 1,
      maxDepth: 5,
      executionChain: new Set<string>(),
      outputs: {} as Record<string, unknown>,
      errors: [] as Array<{ property: string; message: string }>,
      warnings: [] as Array<{ property: string; message: string }>,
    };
  }

  private async processJob(job: Job<ScheduledJobPayload>): Promise<void> {
    const startTime = Date.now();
    const { jobId, jobName, automationId, collectionId, actionType, actions, script } = job.data;

    // Per-automation rate limiting (W7.C / Plan Fix 14). A runaway automation
    // is parked in the delayed set rather than holding a worker slot, so other
    // automations keep flowing through the shared concurrency pool.
    const rateLimitKey = automationId ?? jobId;
    const decision = await this.rateLimiter.tryAcquire(rateLimitKey);
    if (!decision.allowed) {
      const delayMs = decision.retryAfterMs ?? 1_000;
      this.logger.warn(
        `Rate limit (${decision.reason}) for automation ${rateLimitKey}; deferring job ${job.id} for ${delayMs}ms`,
      );
      await job.moveToDelayed(Date.now() + delayMs, job.token);
      return;
    }

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
    } finally {
      await this.rateLimiter.release(rateLimitKey);
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

  /**
   * Returns the count of dead-lettered scheduled jobs. Operators consume
   * this to track DLQ growth. Returns zero when the DLQ is not initialized
   * (e.g., Redis was unavailable at startup).
   */
  async getDlqSize(): Promise<number> {
    if (!this.dlqQueue) {
      return 0;
    }
    return this.dlqQueue.getWaitingCount();
  }
}
