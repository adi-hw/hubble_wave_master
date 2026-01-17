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
} from '@hubblewave/ai';
import { DataSource } from 'typeorm';
import { JwtAuthGuard, CurrentUser } from '@hubblewave/auth-guard';

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
    private dataSource: DataSource
  ) {}

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
  @ApiOperation({ summary: 'Initialize vector store for this instance' })
  @ApiResponse({ status: 200, description: 'Vector store initialized' })
  async initialize(@CurrentUser() _user: any) {
    await this.vectorStoreService.initializeVectorStore(this.dataSource);

    return { message: 'Vector store initialized successfully' };
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
    @Body() dto: IndexKnowledgeArticleDto
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
    @CurrentUser() _user: any,
    @Body() dto: IndexCatalogItemDto
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

    const result = await this.embeddingService.indexCatalogItem(this.dataSource, dto);

    return { queued: false, result };
  }

  @Post('index/record')
  @ApiOperation({ summary: 'Index a record from any collection' })
  @ApiResponse({ status: 200, description: 'Indexing result' })
  async indexRecord(
    @CurrentUser() _user: any,
    @Body() dto: IndexRecordDto
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

    const result = await this.embeddingService.indexRecord(this.dataSource, dto);

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

    const jobId = await this.embeddingQueueService.scheduleReindex(dto.sourceTypes);

    return {
      success: true,
      jobId,
      message: 'Reindex scheduled',
    };
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

