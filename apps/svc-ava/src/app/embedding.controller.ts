import {
  Controller,
  Post,
  Delete,
  Get,
  Body,
  Param,
  Req,
  UseGuards,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import {
  EmbeddingService,
  EmbeddingQueueService,
  VectorStoreService,
} from '@hubblewave/ai';
import { DataSource } from 'typeorm';
import {
  JwtAuthGuard,
  CurrentUser,
  Roles,
  RolesGuard,
  AuthenticatedRequest,
  extractContext,
} from '@hubblewave/auth-guard';
import { RedisService } from '@hubblewave/redis';

// Distributed lock TTL: full reindex/initialize jobs are bounded by this
// horizon. If a job dies without releasing the lock it expires automatically.
const EMBEDDING_REINDEX_LOCK_TTL_SECONDS = 1800;

interface IndexKnowledgeArticleDto {
  id: string;
  title: string;
  content: string;
  summary?: string;
  categoryId?: string;
  tags?: string[];
}

interface IndexCatalogItemDto {
  id: string;
  label: string;
  shortDescription: string;
  description?: string;
  categoryId?: string;
  categoryLabel?: string;
}

interface IndexRecordDto {
  collectionName: string;
  id: string;
  displayValue: string;
  searchableFields: Record<string, string>;
}

interface SearchDto {
  query: string;
  limit?: number;
  threshold?: number;
  sourceTypes?: string[];
}

@ApiTags('AI Embeddings')
@ApiBearerAuth()
@Controller('embeddings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EmbeddingController {
  private readonly logger = new Logger(EmbeddingController.name);

  constructor(
    private embeddingService: EmbeddingService,
    private embeddingQueueService: EmbeddingQueueService,
    private vectorStoreService: VectorStoreService,
    private dataSource: DataSource,
    private redisService: RedisService,
  ) {}

  /**
   * Acquire a distributed lock so concurrent reindex/initialize calls do not
   * stampede. Returns the job id that owns the lock if already held.
   */
  private async acquireReindexLock(jobId: string): Promise<{ acquired: true } | { acquired: false; heldBy: string }> {
    const key = 'embedding:reindex:lock';
    const client = this.redisService.getClient();
    // SET NX EX — atomic "set if not exists" with TTL.
    const result = await client.set(key, jobId, 'EX', EMBEDDING_REINDEX_LOCK_TTL_SECONDS, 'NX');
    if (result === 'OK') {
      return { acquired: true };
    }
    const current = (await client.get(key)) || 'unknown';
    return { acquired: false, heldBy: current };
  }

  private async releaseReindexLock(jobId: string): Promise<void> {
    const key = 'embedding:reindex:lock';
    const client = this.redisService.getClient();
    // Only release the lock if we still own it.
    const lua =
      'if redis.call("GET", KEYS[1]) == ARGV[1] then return redis.call("DEL", KEYS[1]) else return 0 end';
    try {
      await client.eval(lua, 1, key, jobId);
    } catch (error) {
      this.logger.warn(`Failed to release embedding reindex lock: ${(error as Error).message}`);
    }
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get embedding statistics for this instance' })
  @ApiResponse({ status: 200, description: 'Embedding statistics' })
  async getStats(@CurrentUser() _user: any) {
    const counts = await this.vectorStoreService.getDocumentCounts(this.dataSource);
    const queueStats = await this.embeddingQueueService.getStats();

    return {
      documentCounts: counts,
      totalDocuments: Object.values(counts).reduce((a, b) => a + b, 0),
      queueEnabled: this.embeddingQueueService.isQueueEnabled(),
      queueStats,
    };
  }

  @Post('initialize')
  @Roles('admin')
  @ApiOperation({ summary: 'Initialize vector store for this instance' })
  @ApiResponse({ status: 200, description: 'Vector store initialized' })
  async initialize(@CurrentUser() _user: any) {
    const jobId = randomUUID();
    const lock = await this.acquireReindexLock(jobId);
    if (!lock.acquired) {
      throw new ConflictException({
        message: 'Vector store initialize/reindex already in progress',
        currentJobId: lock.heldBy,
      });
    }
    try {
      await this.vectorStoreService.initializeVectorStore(this.dataSource);
      return { message: 'Vector store initialized successfully', jobId };
    } finally {
      await this.releaseReindexLock(jobId);
    }
  }

  @Post('search')
  @ApiOperation({ summary: 'Search documents using semantic similarity' })
  @ApiResponse({ status: 200, description: 'Search results' })
  async search(
    @CurrentUser() _user: any,
    @Body() dto: SearchDto
  ) {
    const results = await this.vectorStoreService.search(this.dataSource, dto.query, {
      limit: dto.limit,
      threshold: dto.threshold,
      sourceTypes: dto.sourceTypes,
    });

    return { results };
  }

  @Post('index/knowledge-article')
  @ApiOperation({ summary: 'Index a knowledge article' })
  @ApiResponse({ status: 200, description: 'Indexing result' })
  async indexKnowledgeArticle(
    @CurrentUser() _user: any,
    @Body() dto: IndexKnowledgeArticleDto,
    @Req() req: AuthenticatedRequest,
  ) {
    // If queue is enabled, add to queue for background processing
    if (this.embeddingQueueService.isQueueEnabled()) {
      const jobId = await this.embeddingQueueService.addJob({
        sourceType: 'knowledge_article',
        sourceId: dto.id,
        action: 'index',
        data: dto as unknown as Record<string, unknown>,
      });

      return {
        queued: true,
        jobId,
        message: 'Article queued for indexing',
      };
    }

    // Process synchronously if queue not available
    const result = await this.embeddingService.indexKnowledgeArticle(
      this.dataSource,
      dto,
      extractContext(req),
    );

    return {
      queued: false,
      result,
    };
  }

  @Post('index/catalog-item')
  @ApiOperation({ summary: 'Index a catalog item' })
  @ApiResponse({ status: 200, description: 'Indexing result' })
  async indexCatalogItem(
    @CurrentUser() _user: any,
    @Body() dto: IndexCatalogItemDto,
    @Req() req: AuthenticatedRequest,
  ) {
    if (this.embeddingQueueService.isQueueEnabled()) {
      const jobId = await this.embeddingQueueService.addJob({
        sourceType: 'catalog_item',
        sourceId: dto.id,
        action: 'index',
        data: dto as unknown as Record<string, unknown>,
      });

      return { queued: true, jobId };
    }

    const result = await this.embeddingService.indexCatalogItem(
      this.dataSource,
      dto,
      extractContext(req),
    );

    return { queued: false, result };
  }

  @Post('index/record')
  @ApiOperation({ summary: 'Index a record from any collection' })
  @ApiResponse({ status: 200, description: 'Indexing result' })
  async indexRecord(
    @CurrentUser() _user: any,
    @Body() dto: IndexRecordDto,
    @Req() req: AuthenticatedRequest,
  ) {
    if (this.embeddingQueueService.isQueueEnabled()) {
      const jobId = await this.embeddingQueueService.addJob({
        sourceType: 'record',
        sourceId: `${dto.collectionName}:${dto.id}`,
        action: 'index',
        data: dto as unknown as Record<string, unknown>,
      });

      return { queued: true, jobId };
    }

    const result = await this.embeddingService.indexRecord(
      this.dataSource,
      dto,
      extractContext(req),
    );

    return { queued: false, result };
  }

  @Delete(':sourceType/:sourceId')
  @ApiOperation({ summary: 'Remove a document from the index' })
  @ApiResponse({ status: 200, description: 'Document removed' })
  async removeFromIndex(
    @CurrentUser() _user: any,
    @Param('sourceType') sourceType: string,
    @Param('sourceId') sourceId: string
  ) {
    if (this.embeddingQueueService.isQueueEnabled()) {
      const jobId = await this.embeddingQueueService.addJob({
        sourceType: sourceType as 'knowledge_article' | 'catalog_item' | 'record',
        sourceId,
        action: 'delete',
      });

      return { queued: true, jobId };
    }

    await this.embeddingService.removeFromIndex(this.dataSource, sourceType, sourceId);

    return { success: true };
  }

  @Post('reindex')
  @Roles('admin')
  @ApiOperation({ summary: 'Schedule a full reindex for this instance' })
  @ApiResponse({ status: 200, description: 'Reindex scheduled' })
  async scheduleReindex(
    @CurrentUser() _user: any,
    @Body() dto: { sourceTypes?: string[] }
  ) {
    if (!this.embeddingQueueService.isQueueEnabled()) {
      return {
        success: false,
        error: 'Queue not available. Reindex requires Redis.',
      };
    }

    // Acquire distributed lock so two admins cannot kick off simultaneous
    // full reindex jobs. The lock is released as soon as the job is enqueued
    // (the queue itself serialises execution from there).
    const ownerId = randomUUID();
    const lock = await this.acquireReindexLock(ownerId);
    if (!lock.acquired) {
      throw new ConflictException({
        message: 'Embedding reindex already in progress',
        currentJobId: lock.heldBy,
      });
    }
    try {
      const jobId = await this.embeddingQueueService.scheduleReindex(dto.sourceTypes);
      return {
        success: true,
        jobId,
        message: 'Reindex scheduled',
      };
    } finally {
      await this.releaseReindexLock(ownerId);
    }
  }

  @Get('queue/jobs')
  @ApiOperation({ summary: 'Get queue jobs for this instance' })
  @ApiResponse({ status: 200, description: 'Queue jobs' })
  async getQueueJobs(
    @CurrentUser() _user: any
  ) {
    const jobs = await this.embeddingQueueService.getJobs();

    return {
      jobs: jobs.map((job) => ({
        id: job.id,
        name: job.name,
        data: job.data,
        progress: job.progress,
        attemptsMade: job.attemptsMade,
        timestamp: job.timestamp,
      })),
    };
  }

  @Post('queue/retry')
  @ApiOperation({ summary: 'Retry failed jobs for this instance' })
  @ApiResponse({ status: 200, description: 'Jobs retried' })
  async retryFailedJobs(@CurrentUser() _user: any) {
    const count = await this.embeddingQueueService.retryFailedJobs();

    return { retriedCount: count };
  }
}

