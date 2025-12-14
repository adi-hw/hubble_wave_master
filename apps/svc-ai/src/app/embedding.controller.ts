import {
  Controller,
  Post,
  Delete,
  Get,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import {
  EmbeddingService,
  EmbeddingQueueService,
  VectorStoreService,
} from '@eam-platform/ai';
import { TenantDbService } from '@eam-platform/tenant-db';
import { JwtAuthGuard, CurrentUser } from '@eam-platform/auth-guard';

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
@Controller('api/embeddings')
@UseGuards(JwtAuthGuard)
export class EmbeddingController {
  constructor(
    private embeddingService: EmbeddingService,
    private embeddingQueueService: EmbeddingQueueService,
    private vectorStoreService: VectorStoreService,
    private tenantDbService: TenantDbService
  ) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get embedding statistics for tenant' })
  @ApiResponse({ status: 200, description: 'Embedding statistics' })
  async getStats(@CurrentUser() user: { tenantId: string }) {
    const dataSource = await this.tenantDbService.getDataSource(
      user.tenantId
    );

    const counts = await this.vectorStoreService.getDocumentCounts(dataSource);
    const queueStats = await this.embeddingQueueService.getStats();

    return {
      documentCounts: counts,
      totalDocuments: Object.values(counts).reduce((a, b) => a + b, 0),
      queueEnabled: this.embeddingQueueService.isQueueEnabled(),
      queueStats,
    };
  }

  @Post('initialize')
  @ApiOperation({ summary: 'Initialize vector store for tenant' })
  @ApiResponse({ status: 200, description: 'Vector store initialized' })
  async initialize(@CurrentUser() user: { tenantId: string }) {
    const dataSource = await this.tenantDbService.getDataSource(
      user.tenantId
    );

    await this.vectorStoreService.initializeTenantVectorStore(dataSource);

    return { message: 'Vector store initialized successfully' };
  }

  @Post('search')
  @ApiOperation({ summary: 'Search documents using semantic similarity' })
  @ApiResponse({ status: 200, description: 'Search results' })
  async search(
    @CurrentUser() user: { tenantId: string },
    @Body() dto: SearchDto
  ) {
    const dataSource = await this.tenantDbService.getDataSource(
      user.tenantId
    );

    const results = await this.vectorStoreService.search(dataSource, dto.query, {
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
    @CurrentUser() user: { tenantId: string },
    @Body() dto: IndexKnowledgeArticleDto
  ) {
    // If queue is enabled, add to queue for background processing
    if (this.embeddingQueueService.isQueueEnabled()) {
      const jobId = await this.embeddingQueueService.addJob({
        tenantId: user.tenantId,
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
    const dataSource = await this.tenantDbService.getDataSource(
      user.tenantId
    );

    const result = await this.embeddingService.indexKnowledgeArticle(
      dataSource,
      dto
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
    @CurrentUser() user: { tenantId: string },
    @Body() dto: IndexCatalogItemDto
  ) {
    if (this.embeddingQueueService.isQueueEnabled()) {
      const jobId = await this.embeddingQueueService.addJob({
        tenantId: user.tenantId,
        sourceType: 'catalog_item',
        sourceId: dto.id,
        action: 'index',
        data: dto as unknown as Record<string, unknown>,
      });

      return { queued: true, jobId };
    }

    const dataSource = await this.tenantDbService.getDataSource(
      user.tenantId
    );

    const result = await this.embeddingService.indexCatalogItem(dataSource, dto);

    return { queued: false, result };
  }

  @Post('index/record')
  @ApiOperation({ summary: 'Index a record from any collection' })
  @ApiResponse({ status: 200, description: 'Indexing result' })
  async indexRecord(
    @CurrentUser() user: { tenantId: string },
    @Body() dto: IndexRecordDto
  ) {
    if (this.embeddingQueueService.isQueueEnabled()) {
      const jobId = await this.embeddingQueueService.addJob({
        tenantId: user.tenantId,
        sourceType: 'record',
        sourceId: `${dto.collectionName}:${dto.id}`,
        action: 'index',
        data: dto as unknown as Record<string, unknown>,
      });

      return { queued: true, jobId };
    }

    const dataSource = await this.tenantDbService.getDataSource(
      user.tenantId
    );

    const result = await this.embeddingService.indexRecord(dataSource, dto);

    return { queued: false, result };
  }

  @Delete(':sourceType/:sourceId')
  @ApiOperation({ summary: 'Remove a document from the index' })
  @ApiResponse({ status: 200, description: 'Document removed' })
  async removeFromIndex(
    @CurrentUser() user: { tenantId: string },
    @Param('sourceType') sourceType: string,
    @Param('sourceId') sourceId: string
  ) {
    if (this.embeddingQueueService.isQueueEnabled()) {
      const jobId = await this.embeddingQueueService.addJob({
        tenantId: user.tenantId,
        sourceType: sourceType as 'knowledge_article' | 'catalog_item' | 'record',
        sourceId,
        action: 'delete',
      });

      return { queued: true, jobId };
    }

    const dataSource = await this.tenantDbService.getDataSource(
      user.tenantId
    );

    await this.embeddingService.removeFromIndex(dataSource, sourceType, sourceId);

    return { success: true };
  }

  @Post('reindex')
  @ApiOperation({ summary: 'Schedule a full reindex for the tenant' })
  @ApiResponse({ status: 200, description: 'Reindex scheduled' })
  async scheduleReindex(
    @CurrentUser() user: { tenantId: string },
    @Body() dto: { sourceTypes?: string[] }
  ) {
    if (!this.embeddingQueueService.isQueueEnabled()) {
      return {
        success: false,
        error: 'Queue not available. Reindex requires Redis.',
      };
    }

    const jobId = await this.embeddingQueueService.scheduleReindex(
      user.tenantId,
      dto.sourceTypes
    );

    return {
      success: true,
      jobId,
      message: 'Reindex scheduled',
    };
  }

  @Get('queue/jobs')
  @ApiOperation({ summary: 'Get queue jobs for tenant' })
  @ApiResponse({ status: 200, description: 'Queue jobs' })
  async getQueueJobs(
    @CurrentUser() user: { tenantId: string }
  ) {
    const jobs = await this.embeddingQueueService.getTenantJobs(user.tenantId);

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
  @ApiOperation({ summary: 'Retry failed jobs for tenant' })
  @ApiResponse({ status: 200, description: 'Jobs retried' })
  async retryFailedJobs(@CurrentUser() user: { tenantId: string }) {
    const count = await this.embeddingQueueService.retryFailedJobs(user.tenantId);

    return { retriedCount: count };
  }
}
