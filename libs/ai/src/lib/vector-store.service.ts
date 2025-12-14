import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { LLMService } from './llm.service';

// Vector dimension for BGE-large-en is 1024
const VECTOR_DIMENSION = 1024;

export interface DocumentChunk {
  id: string;
  tenantId: string;
  sourceType: 'knowledge_article' | 'catalog_item' | 'record' | 'comment' | 'attachment';
  sourceId: string;
  content: string;
  metadata: Record<string, unknown>;
  embedding?: number[];
  createdAt: Date;
  updatedAt: Date;
}

export interface SearchResult {
  id: string;
  sourceType: string;
  sourceId: string;
  content: string;
  metadata: Record<string, unknown>;
  similarity: number;
}

export interface VectorSearchOptions {
  limit?: number;
  threshold?: number;
  sourceTypes?: string[];
  metadata?: Record<string, unknown>;
}

@Injectable()
export class VectorStoreService {
  private readonly logger = new Logger(VectorStoreService.name);

  constructor(private llmService: LLMService) {}

  /**
   * Initialize pgvector extension and create vector table for a tenant
   */
  async initializeTenantVectorStore(dataSource: DataSource): Promise<void> {
    const queryRunner = dataSource.createQueryRunner();

    try {
      await queryRunner.connect();

      // Enable pgvector extension
      await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS vector`);

      // Create document chunks table with vector column
      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS document_chunks (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          source_type VARCHAR(50) NOT NULL,
          source_id VARCHAR(255) NOT NULL,
          content TEXT NOT NULL,
          metadata JSONB DEFAULT '{}',
          embedding vector(${VECTOR_DIMENSION}),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          UNIQUE(source_type, source_id, content)
        )
      `);

      // Create index for vector similarity search using HNSW (faster for large datasets)
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding
        ON document_chunks
        USING hnsw (embedding vector_cosine_ops)
        WITH (m = 16, ef_construction = 64)
      `);

      // Create indexes for filtering
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS idx_document_chunks_source_type
        ON document_chunks (source_type)
      `);

      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS idx_document_chunks_source_id
        ON document_chunks (source_id)
      `);

      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS idx_document_chunks_metadata
        ON document_chunks USING gin (metadata)
      `);

      this.logger.log('Tenant vector store initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize vector store', error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Add or update a document chunk with its embedding
   */
  async upsertDocument(
    dataSource: DataSource,
    chunk: Omit<DocumentChunk, 'id' | 'embedding' | 'createdAt' | 'updatedAt'>
  ): Promise<string> {
    // Generate embedding for the content
    const embedding = await this.llmService.getEmbedding(chunk.content);
    const embeddingStr = `[${embedding.join(',')}]`;

    const result = await dataSource.query(
      `
      INSERT INTO document_chunks (source_type, source_id, content, metadata, embedding)
      VALUES ($1, $2, $3, $4, $5::vector)
      ON CONFLICT (source_type, source_id, content)
      DO UPDATE SET
        metadata = EXCLUDED.metadata,
        embedding = EXCLUDED.embedding,
        updated_at = NOW()
      RETURNING id
      `,
      [
        chunk.sourceType,
        chunk.sourceId,
        chunk.content,
        JSON.stringify(chunk.metadata),
        embeddingStr,
      ]
    );

    return result[0].id;
  }

  /**
   * Add multiple document chunks with embeddings (batch operation)
   */
  async upsertDocuments(
    dataSource: DataSource,
    chunks: Omit<DocumentChunk, 'id' | 'embedding' | 'createdAt' | 'updatedAt'>[]
  ): Promise<string[]> {
    const ids: string[] = [];

    // Process in batches - vLLM supports native batch embeddings
    const batchSize = 32;
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);

      // Get batch embeddings
      const contents = batch.map((c) => c.content);
      const embeddings = await this.llmService.getEmbeddings(contents);

      // Insert all chunks in the batch
      for (let j = 0; j < batch.length; j++) {
        const chunk = batch[j];
        const embedding = embeddings[j];
        const embeddingStr = `[${embedding.join(',')}]`;

        const result = await dataSource.query(
          `
          INSERT INTO document_chunks (source_type, source_id, content, metadata, embedding)
          VALUES ($1, $2, $3, $4, $5::vector)
          ON CONFLICT (source_type, source_id, content)
          DO UPDATE SET
            metadata = EXCLUDED.metadata,
            embedding = EXCLUDED.embedding,
            updated_at = NOW()
          RETURNING id
          `,
          [
            chunk.sourceType,
            chunk.sourceId,
            chunk.content,
            JSON.stringify(chunk.metadata),
            embeddingStr,
          ]
        );
        ids.push(result[0].id);
      }
    }

    return ids;
  }

  /**
   * Perform similarity search using vector embeddings
   */
  async search(
    dataSource: DataSource,
    query: string,
    options: VectorSearchOptions = {}
  ): Promise<SearchResult[]> {
    const { limit = 10, threshold = 0.7, sourceTypes, metadata } = options;

    // Generate embedding for the query
    const queryEmbedding = await this.llmService.getEmbedding(query);
    const embeddingStr = `[${queryEmbedding.join(',')}]`;

    // Build the query with optional filters
    let sql = `
      SELECT
        id,
        source_type,
        source_id,
        content,
        metadata,
        1 - (embedding <=> $1::vector) as similarity
      FROM document_chunks
      WHERE 1 = 1
    `;
    const params: unknown[] = [embeddingStr];
    let paramIndex = 2;

    // Filter by source types
    if (sourceTypes && sourceTypes.length > 0) {
      sql += ` AND source_type = ANY($${paramIndex})`;
      params.push(sourceTypes);
      paramIndex++;
    }

    // Filter by metadata (JSONB containment)
    if (metadata && Object.keys(metadata).length > 0) {
      sql += ` AND metadata @> $${paramIndex}`;
      params.push(JSON.stringify(metadata));
      paramIndex++;
    }

    // Filter by similarity threshold and order by similarity
    sql += `
      AND 1 - (embedding <=> $1::vector) >= $${paramIndex}
      ORDER BY embedding <=> $1::vector
      LIMIT $${paramIndex + 1}
    `;
    params.push(threshold, limit);

    const results = await dataSource.query(sql, params);

    return results.map((row: Record<string, unknown>) => ({
      id: row['id'] as string,
      sourceType: row['source_type'] as string,
      sourceId: row['source_id'] as string,
      content: row['content'] as string,
      metadata: row['metadata'] as Record<string, unknown>,
      similarity: row['similarity'] as number,
    }));
  }

  /**
   * Delete document chunks by source
   */
  async deleteBySource(
    dataSource: DataSource,
    sourceType: string,
    sourceId: string
  ): Promise<number> {
    const result = await dataSource.query(
      `DELETE FROM document_chunks WHERE source_type = $1 AND source_id = $2`,
      [sourceType, sourceId]
    );
    return result[1] || 0;
  }

  /**
   * Delete all document chunks for a specific source type
   */
  async deleteBySourceType(
    dataSource: DataSource,
    sourceType: string
  ): Promise<number> {
    const result = await dataSource.query(
      `DELETE FROM document_chunks WHERE source_type = $1`,
      [sourceType]
    );
    return result[1] || 0;
  }

  /**
   * Get document count by source type
   */
  async getDocumentCounts(
    dataSource: DataSource
  ): Promise<Record<string, number>> {
    const results = await dataSource.query(`
      SELECT source_type, COUNT(*) as count
      FROM document_chunks
      GROUP BY source_type
    `);

    const counts: Record<string, number> = {};
    for (const row of results) {
      counts[row.source_type] = parseInt(row.count, 10);
    }
    return counts;
  }
}
