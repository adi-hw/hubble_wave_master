import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Worker, Job, ConnectionOptions } from 'bullmq';
import { EmbeddingService } from './embedding.service';
import { VectorStoreService } from './vector-store.service';
import { EmbeddingJob, EmbeddingJobResult } from './embedding-queue.service';

// Callback type for getting instance data source (single-instance)
export type GetInstanceDataSourceFn = () => Promise<import('typeorm').DataSource>;

// Deprecated alias for backward compatibility
export type GetTenantDataSourceFn = GetInstanceDataSourceFn;

// Callback type for fetching source data
export type FetchSourceDataFn = (
  sourceType: string,
  sourceId: string
) => Promise<Record<string, unknown> | null>;

@Injectable()
export class EmbeddingWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EmbeddingWorkerService.name);
  private worker: Worker<EmbeddingJob, EmbeddingJobResult> | null = null;
  private connectionOptions: ConnectionOptions | null = null;
  private isEnabled = false;

  private getInstanceDataSource: GetInstanceDataSourceFn | null = null;
  private fetchSourceData: FetchSourceDataFn | null = null;

  constructor(
    private configService: ConfigService,
    private embeddingService: EmbeddingService,
    private vectorStoreService: VectorStoreService
  ) {}

  /**
   * Register callbacks for instance data source and data fetching
   * Must be called before the worker can process jobs
   */
  registerCallbacks(
    getInstanceDataSource: GetInstanceDataSourceFn,
    fetchSourceData: FetchSourceDataFn
  ) {
    this.getInstanceDataSource = getInstanceDataSource;
    this.fetchSourceData = fetchSourceData;
    this.logger.log('Worker callbacks registered');
  }

  async onModuleInit() {
    const redisUrl = this.configService.get<string>('REDIS_URL');
    const workerEnabled = this.configService.get<boolean>(
      'EMBEDDING_WORKER_ENABLED',
      true
    );

    if (!redisUrl || !workerEnabled) {
      this.logger.warn('Embedding worker disabled or Redis not configured');
      return;
    }

    try {
      this.connectionOptions = {
        url: redisUrl,
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
      };

      this.worker = new Worker<EmbeddingJob, EmbeddingJobResult>(
        'embedding-jobs',
        async (job) => this.processJob(job),
        {
          connection: this.connectionOptions,
          concurrency: parseInt(
            this.configService.get<string>('EMBEDDING_WORKER_CONCURRENCY', '2'),
            10
          ),
          limiter: {
            max: 10,
            duration: 1000, // Max 10 jobs per second to avoid overwhelming Ollama
          },
        }
      );

      this.worker.on('completed', (job, result) => {
        this.logger.debug(`Job ${job.id} completed`, result);
      });

      this.worker.on('failed', (job, error) => {
        this.logger.error(`Job ${job?.id} failed: ${error.message}`);
      });

      this.worker.on('error', (error) => {
        this.logger.error('Worker error:', error);
      });

      this.isEnabled = true;
      this.logger.log('Embedding worker started');
    } catch (error) {
      this.logger.error('Failed to start embedding worker', error);
    }
  }

  async onModuleDestroy() {
    if (this.worker) {
      await this.worker.close();
    }
    this.connectionOptions = null;
  }

  isWorkerEnabled(): boolean {
    return this.isEnabled;
  }

  private async processJob(
    job: Job<EmbeddingJob, EmbeddingJobResult>
  ): Promise<EmbeddingJobResult> {
    const startTime = Date.now();
    const { sourceType, sourceId, action, data } = job.data;
    const instanceId = this.getInstanceId();

    this.logger.debug(
      `Processing job: ${action} ${sourceType}/${sourceId} for instance ${instanceId}`
    );

    if (!this.getInstanceDataSource || !this.fetchSourceData) {
      return {
        success: false,
        error: 'Worker callbacks not registered',
      };
    }

    try {
      const dataSource = await this.getInstanceDataSource();

      if (action === 'delete') {
        await this.vectorStoreService.deleteBySource(
          dataSource,
          sourceType,
          sourceId
        );
        return {
          success: true,
          duration: Date.now() - startTime,
        };
      }

      if (sourceType === 'bulk_reindex') {
        return this.processBulkReindex(dataSource, data);
      }

      // Fetch the source data
      const sourceData = await this.fetchSourceData(sourceType, sourceId);
      if (!sourceData) {
        return {
          success: false,
          error: `Source not found: ${sourceType}/${sourceId}`,
        };
      }

      // Index based on source type
      let result;
      switch (sourceType) {
        case 'knowledge_article':
          result = await this.embeddingService.indexKnowledgeArticle(
            dataSource,
            sourceData as {
              id: string;
              title: string;
              content: string;
              summary?: string;
              categoryId?: string;
              tags?: string[];
            }
          );
          break;

        case 'catalog_item':
          result = await this.embeddingService.indexCatalogItem(
            dataSource,
            sourceData as {
              id: string;
              label: string;
              shortDescription: string;
              description?: string;
              categoryId?: string;
              categoryLabel?: string;
            }
          );
          break;

        case 'record':
          result = await this.embeddingService.indexRecord(
            dataSource,
            sourceData as {
              collectionName: string;
              id: string;
              displayValue: string;
              searchableFields: Record<string, string>;
            }
          );
          break;

        default:
          return {
            success: false,
            error: `Unknown source type: ${sourceType}`,
          };
      }

      return {
        success: result.success,
        chunksCreated: result.chunksCreated,
        error: result.error,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      this.logger.error(`Job processing error: ${error}`);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime,
      };
    }
  }

  private async processBulkReindex(
    dataSource: import('typeorm').DataSource,
    data?: Record<string, unknown>
  ): Promise<EmbeddingJobResult> {
    const startTime = Date.now();
    const instanceId = this.getInstanceId();
    const sourceTypes = (data?.['sourceTypes'] as string[]) || [
      'knowledge_article',
      'catalog_item',
    ];

    let totalChunks = 0;
    const errors: string[] = [];

    for (const sourceType of sourceTypes) {
      try {
        // Clear existing embeddings for this source type
        await this.vectorStoreService.deleteBySourceType(dataSource, sourceType);

        // Fetch all items of this type and reindex
        // This would need to be implemented in the main app to fetch all items
        this.logger.log(
          `Bulk reindex scheduled for ${sourceType} in instance ${instanceId}`
        );
      } catch (error) {
        errors.push(
          `Failed to reindex ${sourceType}: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }

    return {
      success: errors.length === 0,
      chunksCreated: totalChunks,
      error: errors.length > 0 ? errors.join('; ') : undefined,
      duration: Date.now() - startTime,
    };
  }

  private getInstanceId(): string {
    return this.configService.get<string>('INSTANCE_ID') || 'default-instance';
  }
}
