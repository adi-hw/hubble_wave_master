import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, Job, QueueEvents } from 'bullmq';
import { EventEmitter2 } from '@nestjs/event-emitter';
import Redis from 'ioredis';

export interface EmbeddingJob {
  tenantId: string;
  sourceType: 'knowledge_article' | 'catalog_item' | 'record' | 'bulk_reindex';
  sourceId: string;
  action: 'index' | 'delete' | 'reindex';
  data?: Record<string, unknown>;
  priority?: number;
}

export interface EmbeddingJobResult {
  success: boolean;
  chunksCreated?: number;
  error?: string;
  duration?: number;
}

export interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}

@Injectable()
export class EmbeddingQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EmbeddingQueueService.name);
  private queue: Queue<EmbeddingJob, EmbeddingJobResult> | null = null;
  private queueEvents: QueueEvents | null = null;
  private connection: Redis | null = null;
  private isEnabled = false;

  constructor(
    private configService: ConfigService,
    private eventEmitter: EventEmitter2
  ) {}

  async onModuleInit() {
    const redisUrl = this.configService.get<string>('REDIS_URL');

    if (!redisUrl) {
      this.logger.warn(
        'REDIS_URL not configured. Embedding queue disabled. Embeddings will be processed synchronously.'
      );
      return;
    }

    try {
      this.connection = new Redis(redisUrl, {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
      });

      this.queue = new Queue<EmbeddingJob, EmbeddingJobResult>('embedding-jobs', {
        connection: this.connection,
        defaultJobOptions: {
          removeOnComplete: 100, // Keep last 100 completed jobs
          removeOnFail: 500, // Keep last 500 failed jobs for debugging
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
        },
      });

      this.queueEvents = new QueueEvents('embedding-jobs', {
        connection: this.connection.duplicate(),
      });

      this.setupEventListeners();
      this.isEnabled = true;
      this.logger.log('Embedding queue initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize embedding queue', error);
      this.isEnabled = false;
    }
  }

  async onModuleDestroy() {
    if (this.queueEvents) {
      await this.queueEvents.close();
    }
    if (this.queue) {
      await this.queue.close();
    }
    if (this.connection) {
      this.connection.disconnect();
    }
  }

  private setupEventListeners() {
    if (!this.queueEvents) return;

    this.queueEvents.on('completed', ({ jobId, returnvalue }) => {
      this.logger.debug(`Job ${jobId} completed`, returnvalue);
      this.eventEmitter.emit('embedding.completed', { jobId, result: returnvalue });
    });

    this.queueEvents.on('failed', ({ jobId, failedReason }) => {
      this.logger.error(`Job ${jobId} failed: ${failedReason}`);
      this.eventEmitter.emit('embedding.failed', { jobId, error: failedReason });
    });

    this.queueEvents.on('progress', ({ jobId, data }) => {
      this.eventEmitter.emit('embedding.progress', { jobId, progress: data });
    });
  }

  isQueueEnabled(): boolean {
    return this.isEnabled;
  }

  /**
   * Add a job to the embedding queue
   */
  async addJob(job: EmbeddingJob): Promise<string | null> {
    if (!this.queue) {
      this.logger.debug('Queue not available, job will not be queued');
      return null;
    }

    const queuedJob = await this.queue.add(
      `${job.action}-${job.sourceType}`,
      job,
      {
        priority: job.priority || 10,
        jobId: `${job.tenantId}:${job.sourceType}:${job.sourceId}:${Date.now()}`,
      }
    );

    this.logger.debug(`Job queued: ${queuedJob.id}`);
    return queuedJob.id || null;
  }

  /**
   * Add multiple jobs in bulk
   */
  async addBulkJobs(jobs: EmbeddingJob[]): Promise<string[]> {
    if (!this.queue || jobs.length === 0) {
      return [];
    }

    const bulkJobs = jobs.map((job) => ({
      name: `${job.action}-${job.sourceType}`,
      data: job,
      opts: {
        priority: job.priority || 10,
        jobId: `${job.tenantId}:${job.sourceType}:${job.sourceId}:${Date.now()}`,
      },
    }));

    const addedJobs = await this.queue.addBulk(bulkJobs);
    return addedJobs.map((j) => j.id || '').filter(Boolean);
  }

  /**
   * Schedule a reindex job for a tenant
   */
  async scheduleReindex(
    tenantId: string,
    sourceTypes?: string[]
  ): Promise<string | null> {
    return this.addJob({
      tenantId,
      sourceType: 'bulk_reindex',
      sourceId: 'all',
      action: 'reindex',
      data: { sourceTypes },
      priority: 20, // Lower priority than individual updates
    });
  }

  /**
   * Get queue statistics
   */
  async getStats(): Promise<QueueStats | null> {
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
   * Get jobs for a specific tenant
   */
  async getTenantJobs(
    tenantId: string,
    status: 'waiting' | 'active' | 'completed' | 'failed' = 'active'
  ): Promise<Job<EmbeddingJob, EmbeddingJobResult>[]> {
    if (!this.queue) return [];

    const jobs = await this.queue.getJobs([status], 0, 100);
    return jobs.filter((job) => job.data.tenantId === tenantId);
  }

  /**
   * Retry all failed jobs for a tenant
   */
  async retryFailedJobs(tenantId?: string): Promise<number> {
    if (!this.queue) return 0;

    const failedJobs = await this.queue.getJobs(['failed'], 0, 1000);
    const jobsToRetry = tenantId
      ? failedJobs.filter((job) => job.data.tenantId === tenantId)
      : failedJobs;

    let retried = 0;
    for (const job of jobsToRetry) {
      await job.retry();
      retried++;
    }

    return retried;
  }

  /**
   * Clear all jobs for a tenant
   */
  async clearTenantJobs(tenantId: string): Promise<number> {
    if (!this.queue) return 0;

    const allJobs = await this.queue.getJobs(
      ['waiting', 'delayed', 'failed'],
      0,
      10000
    );
    const tenantJobs = allJobs.filter((job) => job.data.tenantId === tenantId);

    for (const job of tenantJobs) {
      await job.remove();
    }

    return tenantJobs.length;
  }

  /**
   * Pause the queue
   */
  async pause(): Promise<void> {
    if (this.queue) {
      await this.queue.pause();
      this.logger.log('Embedding queue paused');
    }
  }

  /**
   * Resume the queue
   */
  async resume(): Promise<void> {
    if (this.queue) {
      await this.queue.resume();
      this.logger.log('Embedding queue resumed');
    }
  }
}
