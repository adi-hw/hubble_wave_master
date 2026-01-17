import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, Worker, Job, QueueEvents, ConnectionOptions } from 'bullmq';
import { EventEmitter2 } from '@nestjs/event-emitter';

/**
 * Process Flow Job Types
 */
export type ProcessFlowJobType =
  | 'execute'
  | 'resume'
  | 'wait_complete'
  | 'approval_timeout'
  | 'sla_check';

/**
 * Process Flow Queue Job
 */
export interface ProcessFlowJob {
  type: ProcessFlowJobType;
  instanceId: string;
  nodeId?: string;
  data?: Record<string, unknown>;
}

/**
 * Process Flow Job Result
 */
export interface ProcessFlowJobResult {
  success: boolean;
  instanceId: string;
  nodeId?: string;
  error?: string;
  duration?: number;
}

/**
 * Queue Statistics
 */
export interface ProcessFlowQueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}

/**
 * ProcessFlowQueueService
 *
 * Provides persistent job queue for process flow execution using BullMQ.
 * Replaces in-process setTimeout for distributed deployments.
 * Jobs survive process restarts and can be distributed across workers.
 */
@Injectable()
export class ProcessFlowQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ProcessFlowQueueService.name);
  private readonly platformInstanceId = process.env['INSTANCE_ID'] || 'default-instance';
  private queue: Queue<ProcessFlowJob, ProcessFlowJobResult, string, ProcessFlowJob, ProcessFlowJobResult, string> | null = null;
  private worker: Worker<ProcessFlowJob, ProcessFlowJobResult> | null = null;
  private queueEvents: QueueEvents | null = null;
  private connectionOptions: ConnectionOptions | null = null;
  private isEnabled = false;

  constructor(
    private configService: ConfigService,
    private eventEmitter: EventEmitter2
  ) {}

  async onModuleInit() {
    const redisUrl = this.configService.get<string>('REDIS_URL');

    if (!redisUrl) {
      this.logger.warn(
        'REDIS_URL not configured. Process flow queue disabled. Using in-process timers for delayed jobs.'
      );
      return;
    }

    try {
      this.connectionOptions = {
        url: redisUrl,
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
      };

      const queueName = `process-flow-jobs-${this.platformInstanceId}`;

      this.queue = new Queue<ProcessFlowJob, ProcessFlowJobResult, string, ProcessFlowJob, ProcessFlowJobResult, string>(queueName, {
        connection: this.connectionOptions,
        defaultJobOptions: {
          removeOnComplete: 500,
          removeOnFail: 1000,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
        },
      });

      this.queueEvents = new QueueEvents(queueName, {
        connection: this.connectionOptions,
      });

      this.setupEventListeners();
      this.setupWorker();
      this.isEnabled = true;
      this.logger.log('Process flow queue initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize process flow queue', error);
      this.isEnabled = false;
    }
  }

  async onModuleDestroy() {
    if (this.worker) {
      await this.worker.close();
    }
    if (this.queueEvents) {
      await this.queueEvents.close();
    }
    if (this.queue) {
      await this.queue.close();
    }
    this.connectionOptions = null;
  }

  private setupEventListeners() {
    if (!this.queueEvents) return;

    this.queueEvents.on('completed', ({ jobId, returnvalue }) => {
      this.logger.debug(`Process flow job ${jobId} completed`, returnvalue);
      this.eventEmitter.emit('processFlow.queue.completed', { jobId, result: returnvalue });
    });

    this.queueEvents.on('failed', ({ jobId, failedReason }) => {
      this.logger.error(`Process flow job ${jobId} failed: ${failedReason}`);
      this.eventEmitter.emit('processFlow.queue.failed', { jobId, error: failedReason });
    });

    this.queueEvents.on('progress', ({ jobId, data }) => {
      this.eventEmitter.emit('processFlow.queue.progress', { jobId, progress: data });
    });
  }

  private setupWorker() {
    const queueName = `process-flow-jobs-${this.platformInstanceId}`;
    const connectionOptions = this.connectionOptions;
    if (!connectionOptions) {
      return;
    }

    this.worker = new Worker<ProcessFlowJob, ProcessFlowJobResult>(
      queueName,
      async (job: Job<ProcessFlowJob>) => {
        const startTime = Date.now();

        try {
          switch (job.data.type) {
            case 'execute':
              await this.handleExecuteJob(job);
              break;

            case 'resume':
              await this.handleResumeJob(job);
              break;

            case 'wait_complete':
              await this.handleWaitCompleteJob(job);
              break;

            case 'approval_timeout':
              await this.handleApprovalTimeoutJob(job);
              break;

            case 'sla_check':
              await this.handleSlaCheckJob(job);
              break;

            default:
              this.logger.warn(`Unknown process flow job type: ${job.data.type}`);
          }

          return {
            success: true,
            instanceId: job.data.instanceId,
            nodeId: job.data.nodeId,
            duration: Date.now() - startTime,
          };
        } catch (error: any) {
          this.logger.error(`Process flow job ${job.id} failed: ${error.message}`, error.stack);
          return {
            success: false,
            instanceId: job.data.instanceId,
            nodeId: job.data.nodeId,
            error: error.message,
            duration: Date.now() - startTime,
          };
        }
      },
      {
        connection: connectionOptions,
        concurrency: 5,
      }
    );

    this.worker.on('completed', (job) => {
      this.logger.debug(`Worker completed job ${job.id}`);
    });

    this.worker.on('failed', (job, error) => {
      this.logger.error(`Worker failed job ${job?.id}: ${error.message}`);
    });
  }

  /**
   * Handle process flow execution job
   */
  private async handleExecuteJob(job: Job<ProcessFlowJob>): Promise<void> {
    this.eventEmitter.emit('processFlow.queue.execute', {
      instanceId: job.data.instanceId,
      data: job.data.data,
    });
  }

  /**
   * Handle process flow resume job (after wait/approval)
   */
  private async handleResumeJob(job: Job<ProcessFlowJob>): Promise<void> {
    this.eventEmitter.emit('processFlow.queue.resume', {
      instanceId: job.data.instanceId,
      nodeId: job.data.nodeId,
      data: job.data.data,
    });
  }

  /**
   * Handle wait step completion job
   */
  private async handleWaitCompleteJob(job: Job<ProcessFlowJob>): Promise<void> {
    this.eventEmitter.emit('processFlow.queue.wait_complete', {
      instanceId: job.data.instanceId,
      nodeId: job.data.nodeId,
    });
  }

  /**
   * Handle approval timeout job
   */
  private async handleApprovalTimeoutJob(job: Job<ProcessFlowJob>): Promise<void> {
    this.eventEmitter.emit('processFlow.queue.approval_timeout', {
      instanceId: job.data.instanceId,
      nodeId: job.data.nodeId,
    });
  }

  /**
   * Handle SLA check job
   */
  private async handleSlaCheckJob(job: Job<ProcessFlowJob>): Promise<void> {
    this.eventEmitter.emit('processFlow.queue.sla_check', {
      instanceId: job.data.instanceId,
      data: job.data.data,
    });
  }

  /**
   * Check if queue is enabled
   */
  isQueueEnabled(): boolean {
    return this.isEnabled;
  }

  /**
   * Add a process flow job to the queue
   */
  async addJob(job: ProcessFlowJob, delayMs?: number): Promise<string | null> {
    if (!this.queue) {
      this.logger.debug('Queue not available, job will not be queued');
      return null;
    }

    const jobOptions: Record<string, unknown> = {
      jobId: `${this.platformInstanceId}:${job.type}:${job.instanceId}:${job.nodeId || 'main'}:${Date.now()}`,
    };

    if (delayMs && delayMs > 0) {
      jobOptions['delay'] = delayMs;
    }

    const queuedJob = await this.queue.add(
      `${job.type}-${job.instanceId}`,
      job,
      jobOptions
    );

    this.logger.debug(`Process flow job queued: ${queuedJob.id}`);
    return queuedJob.id || null;
  }

  /**
   * Schedule process flow execution
   */
  async scheduleExecution(instanceId: string, data?: Record<string, unknown>): Promise<string | null> {
    return this.addJob({
      type: 'execute',
      instanceId,
      data,
    });
  }

  /**
   * Schedule process flow resume after delay (for wait steps)
   */
  async scheduleWaitComplete(
    instanceId: string,
    nodeId: string,
    delayMs: number
  ): Promise<string | null> {
    return this.addJob(
      {
        type: 'wait_complete',
        instanceId,
        nodeId,
      },
      delayMs
    );
  }

  /**
   * Schedule approval timeout
   */
  async scheduleApprovalTimeout(
    instanceId: string,
    nodeId: string,
    timeoutMinutes: number
  ): Promise<string | null> {
    const delayMs = timeoutMinutes * 60 * 1000;
    return this.addJob(
      {
        type: 'approval_timeout',
        instanceId,
        nodeId,
      },
      delayMs
    );
  }

  /**
   * Schedule SLA check
   */
  async scheduleSlaCheck(
    instanceId: string,
    checkTimeMs: number,
    data?: Record<string, unknown>
  ): Promise<string | null> {
    return this.addJob(
      {
        type: 'sla_check',
        instanceId,
        data,
      },
      checkTimeMs
    );
  }

  /**
   * Cancel a scheduled job
   */
  async cancelJob(jobId: string): Promise<boolean> {
    if (!this.queue) return false;

    const job = await this.queue.getJob(jobId);
    if (job) {
      await job.remove();
      return true;
    }
    return false;
  }

  /**
   * Cancel all jobs for a process flow instance
   */
  async cancelInstanceJobs(instanceId: string): Promise<number> {
    if (!this.queue) return 0;

    const jobs = await this.queue.getJobs(['waiting', 'delayed']);
    let cancelled = 0;

    for (const job of jobs) {
      if (job.data.instanceId === instanceId) {
        await job.remove();
        cancelled++;
      }
    }

    return cancelled;
  }

  /**
   * Get queue statistics
   */
  async getStats(): Promise<ProcessFlowQueueStats | null> {
    if (!this.queue) return null;

    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.queue.getWaitingCount(),
      this.queue.getActiveCount(),
      this.queue.getCompletedCount(),
      this.queue.getFailedCount(),
      this.queue.getDelayedCount(),
    ]);

    return { waiting, active, completed, failed, delayed };
  }

  /**
   * Get jobs for a specific process flow instance
   */
  async getInstanceJobs(instanceId: string): Promise<Job<ProcessFlowJob, ProcessFlowJobResult>[]> {
    if (!this.queue) return [];

    const jobs = await this.queue.getJobs(['waiting', 'active', 'delayed'], 0, 100);
    return jobs.filter((job) => job.data.instanceId === instanceId);
  }

  /**
   * Retry failed jobs for a process flow instance
   */
  async retryFailedJobs(instanceId?: string): Promise<number> {
    if (!this.queue) return 0;

    const failedJobs = await this.queue.getJobs(['failed'], 0, 1000);
    const jobsToRetry = instanceId
      ? failedJobs.filter((job) => job.data.instanceId === instanceId)
      : failedJobs;

    let retried = 0;
    for (const job of jobsToRetry) {
      await job.retry();
      retried++;
    }

    return retried;
  }

  /**
   * Clear all pending/failed jobs
   */
  async clearJobs(): Promise<number> {
    if (!this.queue) return 0;

    const allJobs = await this.queue.getJobs(
      ['waiting', 'delayed', 'failed'],
      0,
      10000
    );

    for (const job of allJobs) {
      await job.remove();
    }

    return allJobs.length;
  }

  /**
   * Pause the queue
   */
  async pause(): Promise<void> {
    if (this.queue) {
      await this.queue.pause();
      this.logger.log('Process flow queue paused');
    }
  }

  /**
   * Resume the queue
   */
  async resume(): Promise<void> {
    if (this.queue) {
      await this.queue.resume();
      this.logger.log('Process flow queue resumed');
    }
  }
}
